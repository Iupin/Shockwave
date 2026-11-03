import { useEffect, useState } from 'react'
import type { ChangelogPayload, ReleaseNotes } from '../../shared/types'
import { LogoMark } from './LogoMark'

function inlinePieces(text: string): Array<string | JSX.Element> {
  const parts: Array<string | JSX.Element> = []
  const pattern = /(\*\*[^*]+\*\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\))/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[0].startsWith('**')) {
      parts.push(<strong key={key++}>{match[0].slice(2, -2)}</strong>)
    } else {
      parts.push(
        <a key={key++} href={match[3]} target="_blank" rel="noreferrer">
          {match[2]}
        </a>
      )
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function Notes({ release }: { release: ReleaseNotes }): JSX.Element {
  const lines = release.body.replace(/\r\n/g, '\n').split('\n')
  return (
    <article className="changelog-release">
      <h3>{release.title}</h3>
      <div className="changelog-body">
        {lines.map((line, index) => {
          if (line.startsWith('### ')) return <h4 key={index}>{line.slice(4)}</h4>
          if (line.startsWith('## ')) return <h4 key={index}>{line.slice(3)}</h4>
          if (line.startsWith('# ')) return <h4 key={index}>{line.slice(2)}</h4>
          if (/^\s*[-*]\s+/.test(line)) {
            return <li key={index}>{inlinePieces(line.replace(/^\s*[-*]\s+/, ''))}</li>
          }
          if (!line.trim()) return <div key={index} className="changelog-gap" />
          return <p key={index}>{inlinePieces(line)}</p>
        })}
      </div>
    </article>
  )
}

export function Changelog(): JSX.Element | null {
  const [payload, setPayload] = useState<ChangelogPayload | null>(null)

  useEffect(() => {
    void window.shockwave.pendingChangelog().then(setPayload)
  }, [])

  if (!payload) return null

  return (
    <div className="modal-back changelog-back">
      <div className="modal changelog-modal">
        <div className="changelog-head">
          <LogoMark size={48} fill={100} active />
          <div>
            <p className="changelog-kicker">What’s new</p>
            <h2>
              v{payload.fromVersion} → v{payload.toVersion}
            </h2>
          </div>
        </div>
        <div className="changelog-scroll">
          {payload.releases.map((release) => (
            <Notes key={release.version} release={release} />
          ))}
        </div>
        <div className="modal-actions">
          <a className="ghost" href={payload.releases[0]?.url} target="_blank" rel="noreferrer">
            View on GitHub
          </a>
          <button
            className="primary"
            onClick={() => {
              void window.shockwave.dismissChangelog()
              setPayload(null)
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
