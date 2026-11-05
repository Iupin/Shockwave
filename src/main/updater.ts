import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../shared/types'

const FEED = {
  provider: 'github' as const,
  owner: 'Iupin',
  repo: 'Shockwave'
}

let status: UpdateStatus = {
  phase: 'idle',
  currentVersion: '0.0.0'
}

let emit: (next: UpdateStatus) => void = () => {}

function push(patch: Partial<UpdateStatus>): void {
  status = {
    ...status,
    currentVersion: app.getVersion(),
    ...patch
  }
  emit(status)
}

export function getUpdateStatus(): UpdateStatus {
  return { ...status, currentVersion: app.getVersion() }
}

export function configureUpdater(onChange: (next: UpdateStatus) => void): void {
  emit = onChange
  status.currentVersion = app.getVersion()

  autoUpdater.autoDownload = false
  // Install only when the user asks. A silent install starts while Shockwave
  // is still quitting, and the NSIS uninstaller then fails if a file is open.
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowDowngrade = false
  autoUpdater.allowPrerelease = false
  autoUpdater.setFeedURL(FEED)

  autoUpdater.on('checking-for-update', () => {
    push({ phase: 'checking', message: 'Checking GitHub releases…' })
  })

  autoUpdater.on('update-available', (info) => {
    push({
      phase: 'available',
      availableVersion: info.version,
      percent: 0,
      message: `Version ${info.version} is available`
    })
  })

  autoUpdater.on('update-not-available', () => {
    push({ phase: 'not-available', message: 'You’re up to date' })
  })

  autoUpdater.on('download-progress', (progress) => {
    push({
      phase: 'downloading',
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      message: 'Downloading update…'
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    push({
      phase: 'ready',
      availableVersion: info.version,
      percent: 100,
      message: 'Update ready. Restart to install.'
    })
  })

  autoUpdater.on('error', (error) => {
    push({
      phase: 'error',
      message: app.isPackaged
        ? error.message
        : 'Updates run from the installed app, using GitHub Releases.'
    })
  })
}

export async function checkForUpdates(userInitiated = false): Promise<UpdateStatus> {
  if (!app.isPackaged) {
    if (userInitiated) {
      push({
        phase: 'error',
        message: 'Updates run from the installed app, using GitHub Releases.'
      })
    }
    return getUpdateStatus()
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    push({
      phase: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
  }
  return getUpdateStatus()
}

export async function downloadUpdate(): Promise<UpdateStatus> {
  if (status.phase === 'ready') return getUpdateStatus()
  if (!app.isPackaged) {
    push({
      phase: 'error',
      message: 'Updates run from the installed app, using GitHub Releases.'
    })
    return getUpdateStatus()
  }
  try {
    push({ phase: 'downloading', percent: status.percent ?? 0, message: 'Downloading update…' })
    await autoUpdater.downloadUpdate()
  } catch (error) {
    push({
      phase: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
  }
  return getUpdateStatus()
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true)
}
