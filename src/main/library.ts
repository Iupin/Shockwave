import { spawn } from 'child_process'
import { createHash, randomUUID } from 'crypto'
import { shell } from 'electron'
import { copyFileSync, existsSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { extname, isAbsolute, join, relative } from 'path'
import { parseFile } from 'music-metadata'
import { AUDIO_EXTENSIONS, Track, TrackEdit } from '../shared/types'
import { removeTrackFromAllPlaylists } from './playlists'
import { RepositoryLayout, readJson, writeJson } from './repository'

interface LibraryFile {
  tracks: Track[]
}

function isAudioFile(file: string): boolean {
  return AUDIO_EXTENSIONS.includes(extname(file).toLowerCase() as (typeof AUDIO_EXTENSIONS)[number])
}

function walkAudio(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) {
    return files
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkAudio(full, files)
    } else if (entry.isFile() && isAudioFile(entry.name)) {
      files.push(full)
    }
  }
  return files
}

function titleFromFilename(file: string): string {
  return file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
}

export function loadLibrary(layout: RepositoryLayout): Track[] {
  return readJson<LibraryFile>(layout.libraryFile, { tracks: [] }).tracks ?? []
}

export function saveLibrary(layout: RepositoryLayout, tracks: Track[]): void {
  writeJson(layout.libraryFile, { tracks })
}

export async function scanLibrary(layout: RepositoryLayout): Promise<Track[]> {
  const existing = loadLibrary(layout)
  const byRel = new Map(existing.map((track) => [track.relPath.replaceAll('\\', '/'), track]))
  const files = walkAudio(layout.music)
  const next: Track[] = []

  for (const file of files) {
    const relPath = relative(layout.music, file).replaceAll('\\', '/')
    const stats = statSync(file)
    const previous = byRel.get(relPath)
    if (previous && previous.size === stats.size && previous.mtimeMs === stats.mtimeMs) {
      next.push(previous)
      continue
    }
    const refreshed = await readTrack(layout, file, relPath, previous?.id, previous?.coverId)
    next.push(refreshed)
  }

  saveLibrary(layout, next)
  return next
}

function uniqueMusicName(layout: RepositoryLayout, sourcePath: string): string {
  const original = sourcePath.split(/[/\\]/).pop() ?? `track${extname(sourcePath) || '.m4a'}`
  const safe = original.replace(/[<>:"/\\|?*]/g, '_')
  let destName = safe
  let n = 1
  while (existsSync(join(layout.music, destName))) {
    const ext = extname(safe)
    const stem = safe.slice(0, safe.length - ext.length)
    destName = `${stem} (${n})${ext}`
    n += 1
  }
  return destName
}

export async function ingestFile(layout: RepositoryLayout, sourcePath: string): Promise<Track> {
  const relToMusic = relative(layout.music, sourcePath)
  const alreadyInRepo = relToMusic !== '' && !relToMusic.startsWith('..') && !isAbsolute(relToMusic)
  const destName = alreadyInRepo
    ? relative(layout.music, sourcePath).replaceAll('\\', '/')
    : uniqueMusicName(layout, sourcePath)
  const dest = alreadyInRepo ? sourcePath : join(layout.music, destName)
  if (!alreadyInRepo) {
    copyFileSync(sourcePath, dest)
  }
  const track = await readTrack(layout, dest, destName)
  const tracks = loadLibrary(layout).filter((item) => item.relPath !== destName)
  tracks.unshift(track)
  saveLibrary(layout, tracks)
  return track
}

export function findTrack(layout: RepositoryLayout, id: string): Track | undefined {
  return loadLibrary(layout).find((track) => track.id === id)
}

export async function deleteTrack(layout: RepositoryLayout, trackId: string): Promise<Track | undefined> {
  const tracks = loadLibrary(layout)
  const track = tracks.find((item) => item.id === trackId)
  if (!track) return undefined

  const file = resolveTrackPath(layout, track)
  if (existsSync(file)) {
    await shell.trashItem(file)
  }

  saveLibrary(
    layout,
    tracks.filter((item) => item.id !== trackId)
  )
  removeTrackFromAllPlaylists(layout, trackId)

  if (track.coverId) {
    const stillUsed = loadLibrary(layout).some((item) => item.coverId === track.coverId)
    if (!stillUsed) {
      const match = readdirSync(layout.covers).find((name) => name.startsWith(track.coverId as string))
      if (match) {
        try {
          await shell.trashItem(join(layout.covers, match))
        } catch {
          // Cover cleanup is best-effort.
        }
      }
    }
  }

  return track
}

export function resolveTrackPath(layout: RepositoryLayout, track: Track): string {
  return join(layout.music, track.relPath)
}

export function attachCover(layout: RepositoryLayout, image: Buffer): string {
  const coverId = createHash('sha1').update(image).digest('hex').slice(0, 16)
  const ext = image[0] === 0x89 ? '.png' : '.jpg'
  const coverPath = join(layout.covers, `${coverId}${ext}`)
  if (!existsSync(coverPath)) {
    writeFileSync(coverPath, image)
  }
  return coverId
}

export function updateTrackById(layout: RepositoryLayout, trackId: string, edit: TrackEdit): Track | undefined {
  const tracks = loadLibrary(layout)
  const index = tracks.findIndex((track) => track.id === trackId)
  if (index < 0) return undefined
  const year = edit.year && Number.isFinite(edit.year) ? edit.year : undefined
  tracks[index] = {
    ...tracks[index],
    title: edit.title.trim() || tracks[index].title,
    artist: edit.artist.trim() || tracks[index].artist,
    album: edit.album.trim() || 'Unknown album',
    year,
    genre: edit.genre?.trim() || undefined
  }
  saveLibrary(layout, tracks)
  return tracks[index]
}

function writeFileTags(filePath: string, edit: TrackEdit): Promise<void> {
  return new Promise((resolve) => {
    const outPath = `${filePath}.edited${extname(filePath)}`
    const args = [
      '-y',
      '-i',
      filePath,
      '-map',
      '0',
      '-c',
      'copy',
      '-metadata',
      `title=${edit.title}`,
      '-metadata',
      `artist=${edit.artist}`,
      '-metadata',
      `album=${edit.album}`,
      '-metadata',
      `date=${edit.year ?? ''}`,
      '-metadata',
      `genre=${edit.genre ?? ''}`,
      outPath
    ]
    const child = spawn(process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg', args, { windowsHide: true })
    child.on('error', () => resolve())
    child.on('close', (code) => {
      if (code === 0 && existsSync(outPath)) {
        try {
          unlinkSync(filePath)
          renameSync(outPath, filePath)
        } catch {
          /* keep original */
        }
      } else if (existsSync(outPath)) {
        try {
          unlinkSync(outPath)
        } catch {
          /* ignore */
        }
      }
      resolve()
    })
  })
}

export async function editTrack(layout: RepositoryLayout, trackId: string, edit: TrackEdit): Promise<Track | undefined> {
  const updated = updateTrackById(layout, trackId, edit)
  if (!updated) return undefined
  const file = resolveTrackPath(layout, updated)
  if (existsSync(file)) {
    await writeFileTags(file, {
      title: updated.title,
      artist: updated.artist,
      album: updated.album,
      year: updated.year,
      genre: updated.genre
    })
    if (existsSync(file)) {
      const stats = statSync(file)
      updateTrack(layout, updated.relPath, { size: stats.size, mtimeMs: stats.mtimeMs })
      return { ...updated, size: stats.size, mtimeMs: stats.mtimeMs }
    }
  }
  return updated
}

export function updateTrack(
  layout: RepositoryLayout,
  relPath: string,
  patch: Partial<Track>
): Track | undefined {
  const tracks = loadLibrary(layout)
  const normalized = relPath.replaceAll('\\', '/')
  const index = tracks.findIndex((track) => track.relPath === normalized)
  if (index < 0) return undefined
  tracks[index] = { ...tracks[index], ...patch }
  saveLibrary(layout, tracks)
  return tracks[index]
}

async function readTrack(
  layout: RepositoryLayout,
  file: string,
  relPath: string,
  id?: string,
  existingCoverId?: string
): Promise<Track> {
  const trackId = id ?? randomUUID()
  const stats = statSync(file)
  let title = titleFromFilename(relPath.split('/').pop() ?? relPath)
  let artist = 'Unknown artist'
  let album = 'Unknown album'
  let duration = 0
  let year: number | undefined
  let genre: string | undefined
  let coverId = existingCoverId

  try {
    const metadata = await parseFile(file, { duration: true })
    const common = metadata.common
    if (common.title?.trim()) title = common.title.trim()
    if (common.artist?.trim()) artist = common.artist.trim()
    else if (common.artists?.length) artist = common.artists.join(', ')
    if (common.album?.trim()) album = common.album.trim()
    duration = metadata.format.duration ?? 0
    year = common.year
    genre = common.genre?.[0]
    const picture = common.picture?.[0]
    if (picture?.data) {
      coverId = coverId ?? createHash('sha1').update(picture.data).digest('hex').slice(0, 16)
      const coverExt = picture.format?.includes('png') ? '.png' : '.jpg'
      const coverPath = join(layout.covers, `${coverId}${coverExt}`)
      if (!existsSync(coverPath)) {
        writeFileSync(coverPath, picture.data)
      }
    }
  } catch {
    // Filename fallback is enough when tags cannot be read.
  }

  return {
    id: trackId,
    relPath,
    title,
    artist,
    album,
    duration,
    year,
    genre,
    coverId,
    addedAt: new Date().toISOString(),
    size: stats.size,
    mtimeMs: stats.mtimeMs
  }
}
