import { app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell } from 'electron'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { AppSettings, AppState, SearchResults } from '../shared/types'
import { dismissChangelog, pendingChangelog, rememberCurrentVersion } from './changelog'
import { readUserConfig, writeUserConfig } from './config'
import { importFromUrl, importLocalFiles } from './importer'
import { findTrack, loadLibrary, resolveTrackPath, scanLibrary } from './library'
import {
  addToPlaylist,
  createPlaylist,
  deletePlaylist,
  loadPlaylists,
  removeFromPlaylist,
  toggleLiked
} from './playlists'
import { RepositoryLayout, ensureRepository, loadSettings, saveSettings } from './repository'
import { checkForUpdates, configureUpdater, getUpdateStatus, installUpdate } from './updater'

function appIcon(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../build/icon.png')
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'shockwave',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
])

let mainWindow: BrowserWindow | null = null
let layout: RepositoryLayout | null = null

function send(channel: string, payload?: unknown): void {
  mainWindow?.webContents.send(channel, payload)
}

function requireLayout(): RepositoryLayout {
  if (!layout) {
    throw new Error('Choose a repository folder first')
  }
  return layout
}

async function buildState(): Promise<AppState> {
  const config = readUserConfig()
  if (!config.repositoryPath || !existsSync(config.repositoryPath)) {
    layout = null
    return {
      repositoryPath: null,
      tracks: [],
      playlists: [],
      settings: loadSettingsFallback(),
      appVersion: app.getVersion()
    }
  }
  layout = ensureRepository(config.repositoryPath)
  const tracks = await scanLibrary(layout)
  return {
    repositoryPath: layout.root,
    tracks,
    playlists: loadPlaylists(layout),
    settings: loadSettings(layout),
    appVersion: app.getVersion()
  }
}

function loadSettingsFallback(): AppSettings {
  return { volume: 0.8, repeat: 'off', shuffle: false }
}

async function refreshRenderer(): Promise<void> {
  send('state', await buildState())
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#000000',
    show: false,
    autoHideMenuBar: true,
    title: 'Shockwave',
    icon: appIcon(),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#ffffff',
      height: 40
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerProtocol(): void {
  protocol.handle('shockwave', async (request) => {
    try {
      const current = requireLayout()
      const url = new URL(request.url)
      const kind = url.hostname
      const id = decodeURIComponent(url.pathname.replace(/^\//, ''))
      if (kind === 'track') {
        const track = findTrack(current, id)
        if (!track) return new Response('Not found', { status: 404 })
        const file = resolveTrackPath(current, track)
        if (!existsSync(file)) return new Response('Not found', { status: 404 })
        return net.fetch(pathToFileURL(file).toString())
      }
      if (kind === 'cover') {
        const covers = readdirSync(current.covers)
        const match = covers.find((name) => name.startsWith(id))
        if (!match) return new Response('Not found', { status: 404 })
        return net.fetch(pathToFileURL(join(current.covers, match)).toString())
      }
      return new Response('Not found', { status: 404 })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' shockwave:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; media-src 'self' shockwave: blob:; img-src 'self' shockwave: data: blob:; connect-src 'self' shockwave:"
        ]
      }
    })
  })

  registerProtocol()
  rememberCurrentVersion()
  configureUpdater((status) => send('update-status', status))
  const config = readUserConfig()
  if (config.repositoryPath && existsSync(config.repositoryPath)) {
    layout = ensureRepository(config.repositoryPath)
    await scanLibrary(layout)
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('get-state', () => buildState())

ipcMain.handle('choose-repository', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Choose your Shockwave repository',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || !result.filePaths[0]) {
    return buildState()
  }
  const root = result.filePaths[0]
  writeUserConfig({ repositoryPath: root })
  layout = ensureRepository(root)
  await scanLibrary(layout)
  return buildState()
})

ipcMain.handle('open-repository', async () => {
  const current = requireLayout()
  await shell.openPath(current.root)
})

ipcMain.handle('search', async (_event, query: string): Promise<SearchResults> => {
  const current = requireLayout()
  const q = query.trim().toLowerCase()
  const tracks = loadLibrary(current)
  const playlists = loadPlaylists(current)
  if (!q) return { tracks, playlists }
  return {
    tracks: tracks.filter((track) =>
      [track.title, track.artist, track.album, track.relPath, track.genre ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    ),
    playlists: playlists.filter((playlist) => playlist.name.toLowerCase().includes(q))
  }
})

ipcMain.handle('import-files', async (_event, paths: string[]) => {
  const current = requireLayout()
  const result = await importLocalFiles(current, paths)
  await refreshRenderer()
  return result
})

ipcMain.handle('import-url', async (_event, url: string) => {
  const current = requireLayout()
  try {
    await importFromUrl(current, url, (progress) => send('import-progress', progress))
    await refreshRenderer()
  } catch (error) {
    send('import-progress', {
      stage: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
})

ipcMain.handle('create-playlist', async (_event, name: string) => {
  const playlist = createPlaylist(requireLayout(), name)
  await refreshRenderer()
  return playlist
})

ipcMain.handle('add-to-playlist', async (_event, playlistId: string, trackId: string) => {
  addToPlaylist(requireLayout(), playlistId, trackId)
  await refreshRenderer()
})

ipcMain.handle('remove-from-playlist', async (_event, playlistId: string, trackId: string) => {
  removeFromPlaylist(requireLayout(), playlistId, trackId)
  await refreshRenderer()
})

ipcMain.handle('toggle-like', async (_event, trackId: string) => {
  toggleLiked(requireLayout(), trackId)
  await refreshRenderer()
})

ipcMain.handle('delete-playlist', async (_event, playlistId: string) => {
  deletePlaylist(requireLayout(), playlistId)
  await refreshRenderer()
})

ipcMain.handle('save-settings', async (_event, settings: AppSettings) => {
  saveSettings(requireLayout(), settings)
})

ipcMain.handle('get-update-status', () => getUpdateStatus())
ipcMain.handle('check-for-updates', () => checkForUpdates())
ipcMain.handle('install-update', () => installUpdate())
ipcMain.handle('pending-changelog', () => pendingChangelog())
ipcMain.handle('dismiss-changelog', () => dismissChangelog())
