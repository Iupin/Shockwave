import { app } from 'electron'
import { spawn } from 'child_process'
import { chmodSync, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from 'fs'
import { get } from 'https'
import { basename, extname, join } from 'path'
import { AUDIO_EXTENSIONS, ImportProgress, Track } from '../shared/types'
import { attachCover, ingestFile, scanLibrary, updateTrack } from './library'
import { downloadArtwork, enrichFromItunes, identityFromVideo, type YtDlpInfo } from './metadata'
import { RepositoryLayout } from './repository'

const YT_DLP_URL =
  process.platform === 'win32'
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'

function binDir(): string {
  const dir = join(app.getPath('userData'), 'bin')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function bundledYtDlp(): string {
  return join(binDir(), process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
}

function which(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    const probe = process.platform === 'win32' ? 'where' : 'which'
    const child = spawn(probe, [command], { windowsHide: true })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += String(chunk)
    })
    child.on('close', (code) => {
      const first = output.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
      resolve(code === 0 && first ? first : null)
    })
    child.on('error', () => resolve(null))
  })
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = (target: string): void => {
      get(target, (response) => {
        const status = response.statusCode ?? 0
        if (status >= 300 && status < 400 && response.headers.location) {
          request(response.headers.location)
          return
        }
        if (status !== 200) {
          reject(new Error(`Failed to download yt-dlp (${status})`))
          return
        }
        const stream = createWriteStream(dest)
        response.pipe(stream)
        stream.on('finish', () => stream.close(() => resolve()))
        stream.on('error', reject)
      }).on('error', reject)
    }
    request(url)
  })
}

async function ensureYtDlp(onProgress: (progress: ImportProgress) => void): Promise<string> {
  const fromPath = (await which('yt-dlp')) ?? (await which('yt-dlp.exe'))
  if (fromPath) return fromPath
  const bundled = bundledYtDlp()
  if (existsSync(bundled)) return bundled
  onProgress({ stage: 'start', message: 'Downloading yt-dlp…' })
  await downloadFile(YT_DLP_URL, bundled)
  if (process.platform !== 'win32') {
    chmodSync(bundled, 0o755)
  }
  return bundled
}

function hasFfmpeg(): Promise<boolean> {
  return which(process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg').then(Boolean)
}

function runYtDlp(
  binary: string,
  args: string[],
  onProgress: (progress: ImportProgress) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    const onChunk = (chunk: Buffer | string): void => {
      const line = String(chunk)
      const match = line.match(/(\d+(?:\.\d+)?)%/)
      if (match) {
        onProgress({
          stage: 'download',
          message: 'Downloading audio…',
          percent: Number(match[1])
        })
      }
    }
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
      onChunk(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
      onChunk(chunk)
    })
    child.on('error', (error) => reject(error))
    child.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`))
    })
  })
}

function readInfoJson(musicDir: string, audioPath: string): YtDlpInfo {
  const id = basename(audioPath, extname(audioPath))
  const infoPath = join(musicDir, `${id}.info.json`)
  if (!existsSync(infoPath)) return {}
  try {
    return JSON.parse(readFileSync(infoPath, 'utf8')) as YtDlpInfo
  } catch {
    return {}
  }
}

function cleanupSidecars(musicDir: string, audioPath: string): void {
  const id = basename(audioPath, extname(audioPath))
  for (const extra of ['.info.json', '.jpg', '.png', '.webp', '.image']) {
    const file = join(musicDir, `${id}${extra}`)
    if (existsSync(file)) {
      try {
        unlinkSync(file)
      } catch {
        // Sidecar cleanup is best-effort.
      }
    }
  }
}

function embedMetadata(
  audioPath: string,
  identity: { title: string; artist: string; album?: string },
  coverPath?: string
): Promise<void> {
  return new Promise((resolve) => {
    const outPath = `${audioPath}.tagged${extname(audioPath)}`
    const args = ['-y', '-i', audioPath]
    if (coverPath && existsSync(coverPath)) {
      args.push('-i', coverPath, '-map', '0:a', '-map', '1', '-c', 'copy', '-disposition:v:0', 'attached_pic')
    } else {
      args.push('-map', '0:a', '-c', 'copy')
    }
    args.push(
      '-metadata',
      `title=${identity.title}`,
      '-metadata',
      `artist=${identity.artist}`,
      '-metadata',
      `album=${identity.album ?? ''}`,
      outPath
    )
    const child = spawn(process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg', args, { windowsHide: true })
    child.on('error', () => resolve())
    child.on('close', (code) => {
      if (code === 0 && existsSync(outPath)) {
        try {
          unlinkSync(audioPath)
          renameSync(outPath, audioPath)
        } catch {
          // Keep the original file if replace fails.
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

export async function importFromUrl(
  layout: RepositoryLayout,
  url: string,
  onProgress: (progress: ImportProgress) => void
): Promise<void> {
  const binary = await ensureYtDlp(onProgress)
  const ffmpeg = await hasFfmpeg()
  const output = join(layout.music, '%(id)s.%(ext)s')
  const args = [
    '--no-playlist',
    '--newline',
    '--no-warnings',
    '--progress',
    '--windows-filenames',
    '--write-info-json',
    '--write-thumbnail',
    '--print',
    'after_move:filepath',
    '-o',
    output,
    url.trim()
  ]

  if (ffmpeg) {
    args.unshift(
      '-f',
      'bestaudio/best',
      '--extract-audio',
      '--audio-format',
      'm4a',
      '--audio-quality',
      '0',
      '--embed-metadata'
    )
    onProgress({ stage: 'download', message: 'Extracting best audio as M4A…' })
  } else {
    args.unshift('-f', 'bestaudio/best')
    onProgress({
      stage: 'download',
      message: 'Downloading best available audio (install ffmpeg for M4A conversion)…'
    })
  }

  const printed = await runYtDlp(binary, args, onProgress)
  const audioPath = printed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && existsSync(line) && isAudioPath(line))
    .at(-1)

  onProgress({ stage: 'tag', message: 'Looking up official song info…' })
  const info = audioPath ? readInfoJson(layout.music, audioPath) : {}
  let identity = identityFromVideo(info)
  identity = await enrichFromItunes(identity)

  if (audioPath) {
    const relPath = basename(audioPath)
    let coverPath: string | undefined
    const localThumb = ['.jpg', '.png', '.webp'].map((ext) => join(layout.music, `${basename(audioPath, extname(audioPath))}${ext}`)).find(existsSync)
    const artwork =
      (await downloadArtwork(identity.thumbnailUrl)) ??
      (localThumb && existsSync(localThumb) ? readFileSync(localThumb) : null)

    await scanLibrary(layout)
    const patch: Partial<Track> = {
      title: identity.title,
      artist: identity.artist
    }
    if (identity.album) patch.album = identity.album
    if (identity.year) patch.year = identity.year
    if (artwork) {
      patch.coverId = attachCover(layout, artwork)
      coverPath = join(layout.covers, `${patch.coverId}${artwork[0] === 0x89 ? '.png' : '.jpg'}`)
    }
    updateTrack(layout, relPath, patch)
    if (ffmpeg) {
      await embedMetadata(audioPath, identity, coverPath)
      if (existsSync(audioPath)) {
        const stats = statSync(audioPath)
        updateTrack(layout, relPath, { size: stats.size, mtimeMs: stats.mtimeMs })
      }
    }
    cleanupSidecars(layout.music, audioPath)
  } else {
    await scanLibrary(layout)
  }

  onProgress({
    stage: 'done',
    message: identity.official
      ? `Saved ${identity.title} — ${identity.artist}`
      : 'Saved to your repository'
  })
}

export function isAudioPath(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return AUDIO_EXTENSIONS.includes(ext as (typeof AUDIO_EXTENSIONS)[number])
}

export async function importLocalFiles(layout: RepositoryLayout, paths: string[]): Promise<{
  imported: number
  skipped: number
  errors: string[]
}> {
  let imported = 0
  let skipped = 0
  const errors: string[] = []
  for (const filePath of paths) {
    if (!isAudioPath(filePath)) {
      skipped += 1
      continue
    }
    try {
      await ingestFile(layout, filePath)
      imported += 1
    } catch (error) {
      errors.push(`${filePath}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { imported, skipped, errors }
}
