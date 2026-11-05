import { useState } from 'react'
import type { AftershockCommandResult } from '../../shared/types'

type Step = 'developer' | 'wireless' | 'pair' | 'connect' | 'install' | 'done'

const ORDER: Step[] = ['developer', 'wireless', 'pair', 'connect', 'install']

export function AftershockInstall({
  onClose,
  onInstalled
}: {
  onClose: () => void
  onInstalled: () => void
}): JSX.Element {
  const [step, setStep] = useState<Step>('developer')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [address, setAddress] = useState('')
  const [pairPort, setPairPort] = useState('')
  const [code, setCode] = useState('')
  const [connectPort, setConnectPort] = useState('')

  const index = Math.max(0, ORDER.indexOf(step))

  const run = async (action: () => Promise<AftershockCommandResult>, next: Step): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const outcome = await action()
      if (!outcome.ok) {
        setError(outcome.message)
        return
      }
      setStep(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  const portNumber = (value: string): number => Number(value.trim())

  return (
    <div className="modal-back" onClick={() => !busy && step !== 'install' && onClose()}>
      <div className="modal wizard" onClick={(event) => event.stopPropagation()}>
        <p className="wizard-kicker">Wireless debugging</p>
        <h2>
          {step === 'developer' && 'Turn on developer options'}
          {step === 'wireless' && 'Turn on wireless debugging'}
          {step === 'pair' && 'Pair with a code'}
          {step === 'connect' && 'Connect over Wi-Fi'}
          {step === 'install' && 'Install Aftershock'}
          {step === 'done' && 'Aftershock is installed'}
        </h2>
        {step !== 'done' && <p className="wizard-count">Step {index + 1} of {ORDER.length}</p>}

        {step === 'developer' && (
          <ol className="wizard-steps">
            <li>On the phone, open Settings, then About phone, then Software information.</li>
            <li>Tap Build number seven times, until developer mode turns on.</li>
            <li>Enter your PIN if Android asks.</li>
          </ol>
        )}

        {step === 'wireless' && (
          <ol className="wizard-steps">
            <li>Open Settings, then Developer options.</li>
            <li>Turn on Wireless debugging and leave that screen open.</li>
            <li>Keep the phone and this PC on the same Wi-Fi network. Leave the phone unplugged.</li>
          </ol>
        )}

        {step === 'pair' && (
          <>
            <ol className="wizard-steps">
              <li>On Wireless debugging, tap Pair device with pairing code.</li>
              <li>Enter the six-digit code, IP address, and port from that popup.</li>
            </ol>
            <label className="field">
              Pairing code
              <input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} />
            </label>
            <div className="field-row">
              <label className="field">
                IP address
                <input value={address} onChange={(event) => setAddress(event.target.value.trim())} placeholder="192.168.1.79" />
              </label>
              <label className="field">
                Pairing port
                <input inputMode="numeric" value={pairPort} onChange={(event) => setPairPort(event.target.value)} />
              </label>
            </div>
          </>
        )}

        {step === 'connect' && (
          <>
            <ol className="wizard-steps">
              <li>Close the pairing popup.</li>
              <li>Enter the IP address and port at the top of Wireless debugging.</li>
              <li>That port is the connection port, and it is different from the pairing port.</li>
            </ol>
            <div className="field-row">
              <label className="field">
                IP address
                <input value={address} onChange={(event) => setAddress(event.target.value.trim())} />
              </label>
              <label className="field">
                Connection port
                <input inputMode="numeric" value={connectPort} onChange={(event) => setConnectPort(event.target.value)} />
              </label>
            </div>
          </>
        )}

        {step === 'install' && (
          <p>Shockwave installs Aftershock over this Wi-Fi connection, then checks that the app is on the phone.</p>
        )}

        {step === 'done' && <p>You can sync from the phone icon beside the volume control.</p>}

        {error && <p className="wizard-error">{error}</p>}

        <div className="modal-actions">
          {step !== 'developer' && step !== 'done' && (
            <button className="ghost" disabled={busy} onClick={() => setStep(ORDER[index - 1] ?? 'developer')}>
              Back
            </button>
          )}
          {step === 'developer' && (
            <button className="primary" onClick={() => setStep('wireless')}>
              Next
            </button>
          )}
          {step === 'wireless' && (
            <button className="primary" onClick={() => setStep('pair')}>
              Next
            </button>
          )}
          {step === 'pair' && (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => window.shockwave.pairAftershock({ address, port: portNumber(pairPort), code: code.trim() }),
                  'connect'
                )
              }
            >
              {busy ? 'Pairing…' : 'Pair'}
            </button>
          )}
          {step === 'connect' && (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => window.shockwave.connectAftershock({ address, port: portNumber(connectPort) }),
                  'install'
                )
              }
            >
              {busy ? 'Connecting…' : 'Connect'}
            </button>
          )}
          {step === 'install' && (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const outcome = await window.shockwave.installAftershock({ address, port: portNumber(connectPort) })
                  if (outcome.ok) onInstalled()
                  return outcome
                }, 'done')
              }
            >
              {busy ? 'Installing…' : 'Install'}
            </button>
          )}
          {step === 'done' && (
            <button className="primary" onClick={onClose}>
              Done
            </button>
          )}
          {step !== 'done' && (
            <button className="ghost" disabled={busy} onClick={onClose}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
