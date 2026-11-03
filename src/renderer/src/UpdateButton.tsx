import { useEffect, useState } from 'react'
import type { UpdateStatus } from '../../shared/types'
import { LogoMark } from './LogoMark'

const idleStatus: UpdateStatus = {
  phase: 'idle',
  currentVersion: '1.4.0'
}

function fillFor(status: UpdateStatus): number {
  if (status.phase === 'ready') return 100
  if (status.phase === 'downloading') return status.percent ?? 0
  if (status.phase === 'available') return 8
  return 0
}

function formatBytes(value?: number): string {
  if (!value) return ''
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function UpdateButton({ version }: { version: string }): JSX.Element {
  const [status, setStatus] = useState<UpdateStatus>({ ...idleStatus, currentVersion: version })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    void window.shockwave.getUpdateStatus().then(setStatus)
    return window.shockwave.onUpdateStatus(setStatus)
  }, [])

  const hot = status.phase === 'available' || status.phase === 'downloading' || status.phase === 'ready'
  const fill = fillFor(status)
  const shownVersion = status.currentVersion || version

  const onClick = (): void => {
    if (status.phase === 'idle' || status.phase === 'not-available' || status.phase === 'error') {
      void window.shockwave.checkForUpdates()
      return
    }
    if (status.phase === 'checking') return
    if (status.phase === 'available') {
      setOpen(true)
      void window.shockwave.downloadUpdate()
      return
    }
    setOpen(true)
  }

  return (
    <>
      <div className="update-cluster">
        <span className="version-tag">v{shownVersion}</span>
        <button
          className={`update-btn${hot ? ' hot' : ''}`}
          onClick={onClick}
          title={
            hot
              ? status.message || 'Download update'
              : status.message || 'Check for updates'
          }
        >
          <LogoMark
            size={22}
            fill={fill}
            active={hot}
            checking={status.phase === 'checking'}
          />
          <span>{status.phase === 'checking' ? 'Checking' : 'Update'}</span>
        </button>
      </div>

      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal update-modal" onClick={(event) => event.stopPropagation()}>
            <h2>Shockwave update</h2>
            <p>
              {status.availableVersion
                ? `v${shownVersion} → v${status.availableVersion}`
                : status.message || 'Preparing update'}
            </p>
            <div className="update-hero">
              <LogoMark
                size={96}
                fill={fill}
                active={hot}
                checking={status.phase === 'checking'}
              />
            </div>
            <div className="update-track">
              <div className="update-track-fill" style={{ width: `${fill}%` }} />
            </div>
            <div className="update-meta">
              <span>{Math.round(fill)}%</span>
              <span>
                {status.phase === 'downloading' && status.transferred
                  ? `${formatBytes(status.transferred)} / ${formatBytes(status.total)}`
                  : status.message}
              </span>
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setOpen(false)}>
                Hide
              </button>
              {status.phase === 'ready' && (
                <button className="primary" onClick={() => window.shockwave.installUpdate()}>
                  Restart and install
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
