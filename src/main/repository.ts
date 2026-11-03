import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { AppSettings, DEFAULT_SETTINGS, Playlist, Track } from '../shared/types'

export interface RepositoryLayout {
  root: string
  music: string
  playlists: string
  covers: string
  libraryFile: string
  settingsFile: string
}

export function layoutFor(root: string): RepositoryLayout {
  return {
    root,
    music: join(root, 'music'),
    playlists: join(root, 'playlists'),
    covers: join(root, 'covers'),
    libraryFile: join(root, 'library.json'),
    settingsFile: join(root, 'settings.json')
  }
}

export function ensureRepository(root: string): RepositoryLayout {
  const layout = layoutFor(root)
  for (const dir of [layout.root, layout.music, layout.playlists, layout.covers]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }
  if (!existsSync(layout.libraryFile)) {
    writeJson(layout.libraryFile, { tracks: [] as Track[] })
  }
  if (!existsSync(layout.settingsFile)) {
    writeJson(layout.settingsFile, DEFAULT_SETTINGS)
  }
  const likedPath = join(layout.playlists, 'liked.json')
  if (!existsSync(likedPath)) {
    const liked: Playlist = {
      id: 'liked',
      name: 'Liked Songs',
      trackIds: [],
      createdAt: new Date().toISOString(),
      system: 'liked'
    }
    writeJson(likedPath, liked)
  }
  return layout
}

export function writeJson(file: string, value: unknown): void {
  writeFileSync(file, JSON.stringify(value, null, 2), 'utf8')
}

export function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) {
    return fallback
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

export function loadSettings(layout: RepositoryLayout): AppSettings {
  const raw = readJson<Partial<AppSettings>>(layout.settingsFile, {})
  return {
    volume: typeof raw.volume === 'number' ? Math.min(1, Math.max(0, raw.volume)) : DEFAULT_SETTINGS.volume,
    repeat: raw.repeat === 'all' || raw.repeat === 'one' || raw.repeat === 'off' ? raw.repeat : 'off',
    shuffle: Boolean(raw.shuffle)
  }
}

export function saveSettings(layout: RepositoryLayout, settings: AppSettings): void {
  writeJson(layout.settingsFile, settings)
}
