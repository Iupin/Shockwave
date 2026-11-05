import { useEffect, useState } from 'react'
import type { Lyrics, Track } from '../../shared/types'

function activeLine(lyrics: Lyrics, elapsed: number): number {
  if (!lyrics.synced) return -1
  let index = -1
  for (let i = 0; i < lyrics.lines.length; i += 1) {
    const time = lyrics.lines[i].time
    if (time != null && time <= elapsed + 0.15) index = i
  }
  return index
}

export function LyricsPanel({
  track,
  cover,
  elapsed,
  onClose
}: {
  track: Track
  cover?: string
  elapsed: number
  onClose: () => void
}): JSX.Element {
  const [lyrics, setLyrics] = useState<Lyrics | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = (force: boolean): void => {
    setLoading(true)
    setError('')
    window.shockwave
      .getLyrics(track.id, force)
      .then((next) => {
        setLyrics(next)
        setLoading(false)
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : 'Could not look up lyrics')
        setLoading(false)
      })
  }

  useEffect(() => {
    load(false)
  }, [track.id])

  const current = lyrics ? activeLine(lyrics, elapsed) : -1

  useEffect(() => {
    if (current < 0) return
    document.getElementById(`lyric-${current}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [current])

  return (
    <div className="lyrics-back">
      <div className="lyrics-bg" aria-hidden="true">
        {cover ? <img className="lyrics-bg-art" src={cover} alt="" /> : <div className="lyrics-bg-fallback" />}
        <div className="lyrics-bg-shade" />
      </div>
      <div className="lyrics-stage">
        <div className="lyrics-top">
          <button className="lyrics-close" onClick={onClose} title="Close lyrics">
            <span aria-hidden="true">↓</span>
          </button>
          {cover && <img className="lyrics-thumb" src={cover} alt="" />}
          <div className="lyrics-meta">
            <strong>{track.title}</strong>
            <span>{track.artist}</span>
          </div>
        </div>
        <div className="lyrics-scroll">
          <div className="lyrics-column">
            {loading && <p className="lyric-status">Looking for timed lyrics…</p>}
            {error && (
              <>
                <p className="lyric-status">{error}</p>
                <button className="ghost" onClick={() => load(true)}>
                  Try again
                </button>
              </>
            )}
            {lyrics?.instrumental && <p className="lyric-status">This song is instrumental.</p>}
            {lyrics?.missing && (
              <>
                <p className="lyric-status">No timed lyrics found for this song.</p>
                <button className="ghost" onClick={() => load(true)}>
                  Search again
                </button>
              </>
            )}
            {lyrics && !lyrics.missing && !lyrics.instrumental &&
              lyrics.lines.map((line, index) => (
                <p
                  id={`lyric-${index}`}
                  key={`${line.time ?? 'plain'}-${index}`}
                  className={index === current ? 'lyric-line active' : 'lyric-line'}
                >
                  {line.text}
                </p>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
