export const AUDIO_EXTENSIONS = [
  '.mp3',
  '.m4a',
  '.aac',
  '.flac',
  '.wav',
  '.ogg',
  '.opus',
  '.webm',
  '.wma'
] as const

export type RepeatMode = 'off' | 'all' | 'one'

export interface Track {
  id: string
  relPath: string
  title: string
  artist: string
  album: string
  duration: number
  year?: number
  genre?: string
  coverId?: string
  addedAt: string
  size: number
  mtimeMs: number
}

export interface Playlist {
  id: string
  name: string
  trackIds: string[]
  createdAt: string
  system?: 'liked'
}

export interface AppSettings {
  volume: number
  repeat: RepeatMode
  shuffle: boolean
}

export interface AppState {
  repositoryPath: string | null
  tracks: Track[]
  playlists: Playlist[]
  settings: AppSettings
}

export interface SearchResults {
  tracks: Track[]
  playlists: Playlist[]
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export interface ImportProgress {
  stage: 'start' | 'download' | 'tag' | 'done' | 'error'
  message: string
  percent?: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  volume: 0.8,
  repeat: 'off',
  shuffle: false
}
