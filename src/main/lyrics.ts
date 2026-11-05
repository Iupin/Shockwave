import { existsSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { LyricLine, Lyrics, Track } from '../shared/types'
import { fetchJson } from './http'
import { RepositoryLayout, readJson, writeJson } from './repository'

interface LrclibTrack {
  duration?: number
  instrumental?: boolean
  plainLyrics?: string | null
  syncedLyrics?: string | null
}

const inflight = new Map<string, Promise<Lyrics>>()

function cachePath(layout: RepositoryLayout, trackId: string): string {
  const safe = trackId.replace(/[^A-Za-z0-9_-]/g, '')
  return join(layout.lyrics, `${safe || 'track'}.json`)
}

function isLyrics(value: unknown): value is Lyrics {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<Lyrics>
  return typeof record.synced === 'boolean' && typeof record.instrumental === 'boolean' && typeof record.missing === 'boolean' && Array.isArray(record.lines)
}

export function readCachedLyrics(layout: RepositoryLayout, trackId: string): Lyrics | null {
  const cached = readJson<unknown>(cachePath(layout, trackId), null)
  return isLyrics(cached) ? cached : null
}

export function deleteLyrics(layout: RepositoryLayout, trackId: string): void {
  const file = cachePath(layout, trackId)
  if (!existsSync(file)) return
  try {
    unlinkSync(file)
  } catch {
    // Lyric cleanup is best-effort.
  }
}

export function pruneLyrics(layout: RepositoryLayout, trackIds: Set<string>): void {
  if (!existsSync(layout.lyrics)) return
  for (const name of readdirSync(layout.lyrics)) {
    if (!name.endsWith('.json')) continue
    const id = name.slice(0, -'.json'.length)
    if (trackIds.has(id)) continue
    try {
      unlinkSync(join(layout.lyrics, name))
    } catch {
      // Lyric cleanup is best-effort.
    }
  }
}

export function loadLyricsCache(layout: RepositoryLayout, trackIds: Set<string>): Record<string, Lyrics> {
  const lyrics: Record<string, Lyrics> = {}
  for (const id of trackIds) {
    const cached = readCachedLyrics(layout, id)
    if (cached) lyrics[id] = cached
  }
  return lyrics
}

export function parseLrc(source: string): LyricLine[] {
  const offsetMatch = source.match(/\[offset:([+-]?\d+)\]/i)
  const offset = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0
  const lines: LyricLine[] = []
  for (const raw of source.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    if (stamps.length === 0) continue
    const text = raw.slice(raw.lastIndexOf(']') + 1).trim()
    if (!text) continue
    for (const stamp of stamps) {
      const minutes = Number(stamp[1])
      const seconds = Number(stamp[2])
      const fraction = stamp[3] ? Number(stamp[3]) / 10 ** stamp[3].length : 0
      lines.push({ time: minutes * 60 + seconds + fraction + offset, text })
    }
  }
  lines.sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
  return lines
}

function plainLines(source: string): LyricLine[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((text) => ({ time: null, text }))
}

function fromRecord(record: LrclibTrack): Lyrics {
  const syncedLines = record.syncedLyrics ? parseLrc(record.syncedLyrics) : []
  if (syncedLines.length > 0) {
    return { synced: true, instrumental: false, missing: false, lines: syncedLines }
  }
  const lines = record.plainLyrics ? plainLines(record.plainLyrics) : []
  if (lines.length > 0) {
    return { synced: false, instrumental: false, missing: false, lines }
  }
  if (record.instrumental) {
    return { synced: false, instrumental: true, missing: false, lines: [] }
  }
  return { synced: false, instrumental: false, missing: true, lines: [] }
}

function query(track: Track, withDuration: boolean): string {
  const params = new URLSearchParams()
  params.set('track_name', track.title)
  const artist = track.artist.trim().toLowerCase()
  const album = track.album.trim().toLowerCase()
  if (artist && artist !== 'unknown artist') params.set('artist_name', track.artist)
  if (album && album !== 'unknown album') params.set('album_name', track.album)
  if (withDuration && track.duration > 0) params.set('duration', String(Math.round(track.duration)))
  return params.toString()
}

function pickMatch(results: LrclibTrack[], track: Track): LrclibTrack | null {
  const usable = results.filter((item) => item.syncedLyrics || item.plainLyrics || item.instrumental)
  const close =
    track.duration > 0
      ? usable.filter((item) => Math.abs((item.duration ?? track.duration) - track.duration) <= 5)
      : usable
  const pool = close.length > 0 ? close : usable
  return pool.find((item) => item.syncedLyrics) ?? pool.find((item) => item.plainLyrics) ?? pool[0] ?? null
}

async function fetchLyrics(track: Track): Promise<Lyrics> {
  const headers = { Accept: 'application/json' }
  try {
    const exact = await fetchJson<LrclibTrack>(`https://lrclib.net/api/get?${query(track, true)}`, headers)
    return fromRecord(exact)
  } catch (error) {
    const missing = error instanceof Error && error.message.includes('(404)')
    if (!missing) throw error
  }
  const results = await fetchJson<LrclibTrack[]>(`https://lrclib.net/api/search?${query(track, false)}`, headers)
  const match = pickMatch(Array.isArray(results) ? results : [], track)
  return match ? fromRecord(match) : { synced: false, instrumental: false, missing: true, lines: [] }
}

async function loadOrFetch(layout: RepositoryLayout, track: Track, force: boolean): Promise<Lyrics> {
  if (!force) {
    const cached = readCachedLyrics(layout, track.id)
    if (cached) return cached
  } else {
    deleteLyrics(layout, track.id)
  }
  const lyrics = await fetchLyrics(track)
  writeJson(cachePath(layout, track.id), lyrics)
  return lyrics
}

export function lyricsFor(layout: RepositoryLayout, track: Track, force = false): Promise<Lyrics> {
  if (!force) {
    const pending = inflight.get(track.id)
    if (pending) return pending
  }
  const job = loadOrFetch(layout, track, force).finally(() => {
    if (inflight.get(track.id) === job) inflight.delete(track.id)
  })
  inflight.set(track.id, job)
  return job
}
