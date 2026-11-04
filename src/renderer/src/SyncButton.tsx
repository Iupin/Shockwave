import { useEffect, useState } from 'react'
import type { SyncStatus } from '../../shared/types'

export function SyncButton(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<SyncStatus | null>(null)

  useEffect(() => window.shockwave.onSyncStatus(setStatus), [])

  const start = async (): Promise<void> => {
    setStatus({ phase: 'scanning', message: 'Looking for Aftershock', sent: 0, total: 0 })
    setOpen(true)
    setBusy(true)
    try {
      setStatus(await window.shockwave.syncAftershock())
    } finally {
      setBusy(false)
    }
  }

  const percent = status && status.total > 0 ? Math.min(100, Math.round((status.sent / status.total) * 100)) : 0

  return (
    <>
      <button className="import-btn" onClick={() => void start()} disabled={busy}>
        Sync
      </button>
      {open && status && (
        <div className="modal-back" onClick={() => !busy && setOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>Sync to Aftershock</h2>
            <p className="row-sub">{status.message}</p>
            {status.phase === 'sending' && (
              <div className="sync-bar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${percent}%` }} />
              </div>
            )}
            <div className="modal-actions">
              <button className="primary" disabled={busy} onClick={() => setOpen(false)}>
                {busy ? 'Syncing…' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
