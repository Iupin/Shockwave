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

export interface TrackEdit {
  title: string
  artist: string
  album: string
  year?: number
  genre?: string
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
  appVersion: string
}

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'not-available'
  | 'error'

export interface UpdateStatus {
  phase: UpdatePhase
  currentVersion: string
  availableVersion?: string
  percent?: number
  transferred?: number
  total?: number
  message?: string
}

export interface ReleaseNotes {
  version: string
  title: string
  body: string
  url: string
  publishedAt?: string
}

export interface ChangelogPayload {
  fromVersion: string
  toVersion: string
  releases: ReleaseNotes[]
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
