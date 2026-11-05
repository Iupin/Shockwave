import { useEffect, useState } from 'react'
import type { SyncStatus } from '../../shared/types'
import { AftershockInstall } from './AftershockInstall'
import { Icons } from './icons'

export function SyncButton({
  installed,
  promptSeen,
  onInstalled,
  onPromptSeen
}: {
  installed: boolean
  promptSeen: boolean
  onInstalled: () => void
  onPromptSeen: () => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [wizard, setWizard] = useState(false)
  const [choice, setChoice] = useState(false)
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

  const press = (): void => {
    if (!promptSeen) {
      onPromptSeen()
      void window.shockwave.markAftershockPromptSeen()
    }
    if (installed) void start()
    else setChoice(true)
  }

  const markInstalled = async (): Promise<void> => {
    await window.shockwave.markAftershockInstalled()
    setChoice(false)
    onInstalled()
  }

  return (
    <>
      <button
        className={promptSeen ? 'player-icon' : 'player-icon attention'}
        title={installed ? 'Sync to Aftershock' : 'Install Aftershock'}
        onClick={press}
        disabled={busy}
      >
        <Icons.Sync />
      </button>
      {choice && (
        <div className="modal-back" onClick={() => setChoice(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>Aftershock</h2>
            <p>Install Aftershock on your phone over wireless debugging, or skip this if it is already there.</p>
            <div className="modal-actions">
              <button className="ghost" onClick={() => void markInstalled()}>
                It's already installed
              </button>
              <button
                className="primary"
                onClick={() => {
                  setChoice(false)
                  setWizard(true)
                }}
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}
      {wizard && <AftershockInstall onClose={() => setWizard(false)} onInstalled={onInstalled} />}
      {installed && open && status && (
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
