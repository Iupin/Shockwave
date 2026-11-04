import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AppSettings,
  AppState,
  ChangelogPayload,
  ImportProgress,
  ImportResult,
  SearchResults,
  PresencePayload,
  SyncStatus,
  TrackEdit,
  UpdateStatus
} from '../shared/types'

const api = {
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  getState: (): Promise<AppState> => ipcRenderer.invoke('get-state'),
  chooseRepository: (): Promise<AppState> => ipcRenderer.invoke('choose-repository'),
  openRepository: (): Promise<void> => ipcRenderer.invoke('open-repository'),
  search: (query: string): Promise<SearchResults> => ipcRenderer.invoke('search', query),
  importFiles: (paths: string[]): Promise<ImportResult> => ipcRenderer.invoke('import-files', paths),
  importUrl: (url: string): Promise<void> => ipcRenderer.invoke('import-url', url),
  createPlaylist: (name: string) => ipcRenderer.invoke('create-playlist', name),
  addToPlaylist: (playlistId: string, trackId: string) =>
    ipcRenderer.invoke('add-to-playlist', playlistId, trackId),
  removeFromPlaylist: (playlistId: string, trackId: string) =>
    ipcRenderer.invoke('remove-from-playlist', playlistId, trackId),
  toggleLike: (trackId: string) => ipcRenderer.invoke('toggle-like', trackId),
  deletePlaylist: (playlistId: string) => ipcRenderer.invoke('delete-playlist', playlistId),
  deleteTrack: (trackId: string) => ipcRenderer.invoke('delete-track', trackId),
  editTrack: (trackId: string, edit: TrackEdit) => ipcRenderer.invoke('edit-track', trackId, edit),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('save-settings', settings),
  getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('get-update-status'),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (): Promise<UpdateStatus> => ipcRenderer.invoke('download-update'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('install-update'),
  pendingChangelog: (): Promise<ChangelogPayload | null> => ipcRenderer.invoke('pending-changelog'),
  dismissChangelog: (): Promise<void> => ipcRenderer.invoke('dismiss-changelog'),
  setPresence: (payload: PresencePayload | null) => ipcRenderer.invoke('set-presence', payload),
  setDiscordEnabled: (enabled: boolean) => ipcRenderer.invoke('set-discord-enabled', enabled),
  syncAftershock: (): Promise<SyncStatus> => ipcRenderer.invoke('sync-aftershock'),
  onSyncStatus: (callback: (status: SyncStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: SyncStatus): void => callback(status)
    ipcRenderer.on('sync-status', listener)
    return () => {
      ipcRenderer.removeListener('sync-status', listener)
    }
  },
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void => callback(status)
    ipcRenderer.on('update-status', listener)
    return () => {
      ipcRenderer.removeListener('update-status', listener)
    }
  },
  onState: (callback: (state: AppState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppState): void => callback(state)
    ipcRenderer.on('state', listener)
    return () => {
      ipcRenderer.removeListener('state', listener)
    }
  },
  onImportProgress: (callback: (progress: ImportProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ImportProgress): void =>
      callback(progress)
    ipcRenderer.on('import-progress', listener)
    return () => {
      ipcRenderer.removeListener('import-progress', listener)
    }
  }
}

contextBridge.exposeInMainWorld('shockwave', api)

export type ShockwaveApi = typeof api
