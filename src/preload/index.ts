import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AppSettings, AppState, ImportProgress, ImportResult, SearchResults } from '../shared/types'

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
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('save-settings', settings),
  onState: (callback: (state: AppState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppState): void => callback(state)
    ipcRenderer.on('state', listener)
    return () => ipcRenderer.removeListener('state', listener)
  },
  onImportProgress: (callback: (progress: ImportProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ImportProgress): void =>
      callback(progress)
    ipcRenderer.on('import-progress', listener)
    return () => ipcRenderer.removeListener('import-progress', listener)
  }
}

contextBridge.exposeInMainWorld('shockwave', api)

export type ShockwaveApi = typeof api
