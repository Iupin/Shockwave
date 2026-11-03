import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, ImportProgress, Playlist, RepeatMode, Track } from '../../shared/types'
import { Changelog } from './Changelog'
import { Icons } from './icons'
import { UpdateButton } from './UpdateButton'

type View =
  | { kind: 'home' }
  | { kind: 'search' }
  | { kind: 'library' }
  | { kind: 'playlist'; id: string }

const emptyState: AppState = {
  repositoryPath: null,
  tracks: [],
  playlists: [],
  settings: { volume: 0.8, repeat: 'off', shuffle: false },
  appVersion: '1.1.0'
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  const m = Math.floor(whole / 60)
  const s = whole % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function coverUrl(track?: Track): string | undefined {
  return track?.coverId ? `shockwave://cover/${track.coverId}` : undefined
}

function trackUrl(track: Track): string {
  return `shockwave://track/${track.id}`
}

export default function App(): JSX.Element {
  const [state, setState] = useState<AppState>(emptyState)
  const [view, setView] = useState<View>({ kind: 'home' })
  const [history, setHistory] = useState<View[]>([{ kind: 'home' }])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [query, setQuery] = useState('')
  const [searchTracks, setSearchTracks] = useState<Track[]>([])
  const [searchPlaylists, setSearchPlaylists] = useState<Playlist[]>([])
  const [dragging, setDragging] = useState(false)
  const [urlOpen, setUrlOpen] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; trackId: string } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Track | null>(null)

  const [queue, setQueue] = useState<Track[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queueRef = useRef<Track[]>([])
  const queueIndexRef = useRef(0)
  const settingsRef = useRef(state.settings)

  const current = queue[queueIndex]
  queueRef.current = queue
  queueIndexRef.current = queueIndex
  settingsRef.current = state.settings

  const liked = state.playlists.find((p) => p.id === 'liked')
  const likedSet = useMemo(() => new Set(liked?.trackIds ?? []), [liked])

  const goTo = useCallback(
    (next: View) => {
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1)
        return [...trimmed, next]
      })
      setHistoryIndex((index) => index + 1)
      setView(next)
    },
    [historyIndex]
  )

  const back = (): void => {
    if (historyIndex === 0) return
    const index = historyIndex - 1
    setHistoryIndex(index)
    setView(history[index])
  }

  const forward = (): void => {
    if (historyIndex >= history.length - 1) return
    const index = historyIndex + 1
    setHistoryIndex(index)
    setView(history[index])
  }

  useEffect(() => {
    void window.shockwave.getState().then(setState)
    const offState = window.shockwave.onState(setState)
    const offProgress = window.shockwave.onImportProgress(setImportProgress)
    return () => {
      offState()
      offProgress()
    }
  }, [])

  useEffect(() => {
    if (view.kind !== 'search') return
    const handle = window.setTimeout(() => {
      void window.shockwave.search(query).then((results) => {
        setSearchTracks(results.tracks)
        setSearchPlaylists(results.playlists)
      })
    }, 120)
    return () => window.clearTimeout(handle)
  }, [query, view.kind, state.tracks, state.playlists])

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    const onEnded = (): void => {
      const list = queueRef.current
      const index = queueIndexRef.current
      const settings = settingsRef.current
      if (settings.repeat === 'one') {
        audio.currentTime = 0
        void audio.play()
        setPlaying(true)
        return
      }
      let nextIndex = settings.shuffle ? Math.floor(Math.random() * list.length) : index + 1
      if (nextIndex >= list.length) {
        if (settings.repeat === 'all') nextIndex = 0
        else {
          setPlaying(false)
          return
        }
      }
      const next = list[nextIndex]
      if (!next) {
        setPlaying(false)
        return
      }
      queueIndexRef.current = nextIndex
      setQueueIndex(nextIndex)
      audio.src = trackUrl(next)
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
    audio.addEventListener('timeupdate', () => setElapsed(audio.currentTime))
    audio.addEventListener('durationchange', () => setDuration(audio.duration || 0))
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      audio.src = ''
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = state.settings.volume
  }, [state.settings.volume])

  const playList = (tracks: Track[], index: number): void => {
    const audio = audioRef.current
    if (!audio || !tracks[index]) return
    queueRef.current = tracks
    queueIndexRef.current = index
    setQueue(tracks)
    setQueueIndex(index)
    audio.src = trackUrl(tracks[index])
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }

  const togglePlay = (): void => {
    const audio = audioRef.current
    if (!audio) return
    if (!current && state.tracks[0]) {
      playList(state.tracks, 0)
      return
    }
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  const removeFromQueue = (trackId: string): void => {
    const list = queueRef.current
    const index = queueIndexRef.current
    const removedAt = list.findIndex((track) => track.id === trackId)
    const next = list.filter((track) => track.id !== trackId)
    queueRef.current = next
    setQueue(next)
    if (removedAt < 0) return
    const audio = audioRef.current
    if (removedAt < index) {
      const nextIndex = index - 1
      queueIndexRef.current = nextIndex
      setQueueIndex(nextIndex)
      return
    }
    if (removedAt !== index) return
    if (!audio) return
    if (next.length === 0) {
      audio.pause()
      audio.src = ''
      setPlaying(false)
      queueIndexRef.current = 0
      setQueueIndex(0)
      return
    }
    const nextIndex = Math.min(index, next.length - 1)
    playList(next, nextIndex)
  }

  const skip = (delta: number): void => {
    const audio = audioRef.current
    const list = queueRef.current
    const settings = settingsRef.current
    if (!audio || list.length === 0) return
    let nextIndex = queueIndexRef.current + delta
    if (settings.shuffle) {
      nextIndex = Math.floor(Math.random() * list.length)
    } else if (nextIndex < 0) {
      nextIndex = settings.repeat === 'all' ? list.length - 1 : 0
    } else if (nextIndex >= list.length) {
      if (settings.repeat === 'all') nextIndex = 0
      else {
        setPlaying(false)
        return
      }
    }
    const next = list[nextIndex]
    if (!next) return
    queueIndexRef.current = nextIndex
    setQueueIndex(nextIndex)
    audio.src = trackUrl(next)
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }

  const updateSettings = (patch: Partial<AppState['settings']>): void => {
    const settings = { ...state.settings, ...patch }
    setState((prev) => ({ ...prev, settings }))
    void window.shockwave.saveSettings(settings)
  }

  const onDropFiles = async (files: FileList | File[]): Promise<void> => {
    const paths = Array.from(files)
      .map((file) => window.shockwave.getPathForFile(file))
      .filter(Boolean)
    if (paths.length) {
      await window.shockwave.importFiles(paths)
    }
  }

  useEffect(() => {
    const onDragOver = (event: DragEvent): void => {
      event.preventDefault()
      setDragging(true)
    }
    const onDragLeave = (event: DragEvent): void => {
      if (event.relatedTarget === null) setDragging(false)
    }
    const onDrop = (event: DragEvent): void => {
      event.preventDefault()
      setDragging(false)
      if (event.dataTransfer?.files?.length) {
        void onDropFiles(event.dataTransfer.files)
      }
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  if (!state.repositoryPath) {
    return (
      <div className="setup">
        <Changelog />
        <div className="setup-card">
          <Icons.Logo />
          <h1>Shockwave</h1>
          <p>
            Choose a repository folder on this PC. Shockwave will keep your music, playlists, and
            settings there, and the search bar will look through that folder.
          </p>
          <ul>
            <li>Music files live in a music folder inside the repository</li>
            <li>Playlists and library metadata are stored next to your files</li>
            <li>You can drag audio in later, or import audio from a video URL</li>
          </ul>
          <button className="primary" onClick={() => void window.shockwave.chooseRepository().then(setState)}>
            Choose repository
          </button>
        </div>
      </div>
    )
  }

  const playlistView =
    view.kind === 'playlist' ? state.playlists.find((item) => item.id === view.id) : undefined
  const playlistTracks = playlistView
    ? playlistView.trackIds
        .map((id) => state.tracks.find((track) => track.id === id))
        .filter((track): track is Track => Boolean(track))
    : []

  const homeRecent = state.tracks.slice(0, 12)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="app" onClick={() => setMenu(null)}>
      <Changelog />
      <div className="drag-region">SHOCKWAVE</div>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <Icons.Logo />
            Shockwave
          </div>
          <button
            className={`nav-btn ${view.kind === 'home' ? 'active' : ''}`}
            onClick={() => goTo({ kind: 'home' })}
          >
            <Icons.Home /> Home
          </button>
          <button
            className={`nav-btn ${view.kind === 'search' ? 'active' : ''}`}
            onClick={() => goTo({ kind: 'search' })}
          >
            <Icons.Search /> Search
          </button>
          <button
            className={`nav-btn ${view.kind === 'library' ? 'active' : ''}`}
            onClick={() => goTo({ kind: 'library' })}
          >
            <Icons.Library /> Your Library
          </button>
          <div className="library-head">
            Playlists
            <button className="icon-btn" title="Create playlist" onClick={() => setCreateOpen(true)}>
              <Icons.Plus />
            </button>
          </div>
          <div className="playlist-list">
            {state.playlists.map((playlist) => (
              <button
                key={playlist.id}
                className={`playlist-btn ${view.kind === 'playlist' && view.id === playlist.id ? 'active' : ''}`}
                onClick={() => goTo({ kind: 'playlist', id: playlist.id })}
              >
                <div className="cover-sm">
                  {playlist.system === 'liked' ? <Icons.Heart filled /> : <Icons.Playlist />}
                </div>
                <div className="meta">
                  <span>{playlist.name}</span>
                  <small>Playlist · {playlist.trackIds.length} songs</small>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="main">
          <div className="topbar">
            <div className="history">
              <button className="round" onClick={back} disabled={historyIndex === 0}>
                <Icons.ChevronLeft />
              </button>
              <button
                className="round"
                onClick={forward}
                disabled={historyIndex >= history.length - 1}
              >
                <Icons.ChevronRight />
              </button>
            </div>
            <div className="search-wrap">
              <label className="search-box">
                <Icons.Search />
                <input
                  placeholder="What do you want to play?"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    if (view.kind !== 'search') goTo({ kind: 'search' })
                  }}
                  onFocus={() => {
                    if (view.kind !== 'search') goTo({ kind: 'search' })
                  }}
                />
              </label>
              <button className="import-btn" onClick={() => setUrlOpen(true)}>
                Import URL
              </button>
            </div>
            <UpdateButton version={state.appVersion} />
            <button className="repo-chip" onClick={() => void window.shockwave.openRepository()}>
              {state.repositoryPath}
            </button>
          </div>

          <div className="content">
            {view.kind === 'home' && (
              <>
                <div className="hero">
                  <h1>{greeting}</h1>
                </div>
                <h2 className="section-title">Recently added</h2>
                {homeRecent.length === 0 ? (
                  <p className="empty">
                    Your repository is empty. Drag audio files here or import a video URL.
                  </p>
                ) : (
                  <div className="grid">
                    {homeRecent.map((track, index) => (
                      <button key={track.id} className="card" onClick={() => playList(state.tracks, index)}>
                        <div className="cover-lg">
                          {coverUrl(track) ? <img src={coverUrl(track)} alt="" /> : <Icons.Note />}
                          <span className="play-fab">
                            <Icons.Play />
                          </span>
                        </div>
                        <h3>{track.title}</h3>
                        <p>{track.artist}</p>
                      </button>
                    ))}
                  </div>
                )}
                <h2 className="section-title" style={{ marginTop: 32 }}>
                  Playlists
                </h2>
                <div className="grid">
                  {state.playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      className="card"
                      onClick={() => goTo({ kind: 'playlist', id: playlist.id })}
                    >
                      <div className="cover-lg">
                        {playlist.system === 'liked' ? <Icons.Heart filled /> : <Icons.Playlist />}
                      </div>
                      <h3>{playlist.name}</h3>
                      <p>{playlist.trackIds.length} songs</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {view.kind === 'search' && (
              <>
                <h2 className="section-title">{query ? `Results for “${query}”` : 'Search your repository'}</h2>
                {searchPlaylists.length > 0 && (
                  <>
                    <h3 className="section-title">Playlists</h3>
                    <div className="grid">
                      {searchPlaylists.map((playlist) => (
                        <button
                          key={playlist.id}
                          className="card"
                          onClick={() => goTo({ kind: 'playlist', id: playlist.id })}
                        >
                          <div className="cover-lg">
                            <Icons.Playlist />
                          </div>
                          <h3>{playlist.name}</h3>
                          <p>Playlist</p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <TrackTable
                  tracks={searchTracks}
                  currentId={current?.id}
                  likedSet={likedSet}
                  playList={playList}
                  onLike={(id) => void window.shockwave.toggleLike(id)}
                  onMenu={setMenu}
                  onDelete={setPendingDelete}
                />
              </>
            )}

            {view.kind === 'library' && (
              <>
                <h2 className="section-title">Your Library</h2>
                <TrackTable
                  tracks={state.tracks}
                  currentId={current?.id}
                  likedSet={likedSet}
                  playList={playList}
                  onLike={(id) => void window.shockwave.toggleLike(id)}
                  onMenu={setMenu}
                  onDelete={setPendingDelete}
                />
              </>
            )}

            {view.kind === 'playlist' && playlistView && (
              <>
                <div className="playlist-hero">
                  <div className="cover-lg">
                    {playlistView.system === 'liked' ? <Icons.Heart filled /> : <Icons.Playlist />}
                  </div>
                  <div>
                    <div className="label">Playlist</div>
                    <h1>{playlistView.name}</h1>
                    <p className="row-sub">{playlistView.trackIds.length} songs</p>
                    {playlistView.system !== 'liked' && (
                      <button
                        className="ghost"
                        style={{ marginTop: 16 }}
                        onClick={() => {
                          void window.shockwave.deletePlaylist(playlistView.id)
                          goTo({ kind: 'library' })
                        }}
                      >
                        Delete playlist
                      </button>
                    )}
                  </div>
                </div>
                <TrackTable
                  tracks={playlistTracks}
                  currentId={current?.id}
                  likedSet={likedSet}
                  playList={playList}
                  onLike={(id) => void window.shockwave.toggleLike(id)}
                  onMenu={setMenu}
                  onDelete={setPendingDelete}
                />
              </>
            )}
          </div>
        </section>
      </div>

      <footer className="player">
        <div className="now">
          <div className="cover-sm">
            {coverUrl(current) ? <img src={coverUrl(current)} alt="" /> : <Icons.Note />}
          </div>
          <div>
            <strong>{current?.title ?? 'Nothing playing'}</strong>
            <span>{current?.artist ?? 'Choose a track from your repository'}</span>
          </div>
          {current && (
            <button
              className={`heart ${likedSet.has(current.id) ? 'liked' : ''}`}
              onClick={() => void window.shockwave.toggleLike(current.id)}
            >
              <Icons.Heart filled={likedSet.has(current.id)} />
            </button>
          )}
        </div>
        <div className="controls">
          <div className="control-row">
            <button
              className={state.settings.shuffle ? 'on' : ''}
              onClick={() => updateSettings({ shuffle: !state.settings.shuffle })}
              title="Shuffle"
            >
              <Icons.Shuffle />
            </button>
            <button onClick={() => skip(-1)} title="Previous">
              <Icons.Prev />
            </button>
            <button className="play-main" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
              {playing ? <Icons.Pause /> : <Icons.Play />}
            </button>
            <button onClick={() => skip(1)} title="Next">
              <Icons.Next />
            </button>
            <button
              className={state.settings.repeat !== 'off' ? 'on' : ''}
              onClick={() => {
                const order: RepeatMode[] = ['off', 'all', 'one']
                const next = order[(order.indexOf(state.settings.repeat) + 1) % order.length]
                updateSettings({ repeat: next })
              }}
              title="Repeat"
            >
              <Icons.Repeat />
            </button>
          </div>
          <div className="seek">
            <span className="time">{formatTime(elapsed)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={elapsed}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (audioRef.current) audioRef.current.currentTime = value
                setElapsed(value)
              }}
            />
            <span className="time">{formatTime(duration)}</span>
          </div>
        </div>
        <div className="volume-wrap">
          <Icons.Volume />
          <div className="volume">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={state.settings.volume}
              onChange={(event) => updateSettings({ volume: Number(event.target.value) })}
            />
          </div>
        </div>
      </footer>

      {dragging && <div className="drop-overlay">Drop audio into your repository</div>}

      {urlOpen && (
        <div className="modal-back" onClick={() => setUrlOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>Import from URL</h2>
            <p>
              Paste a video or audio link. Shockwave saves the best available audio, and if the
              video is a song it looks up the official title, artist, and artwork.
            </p>
            <input
              autoFocus
              placeholder="https://"
              value={urlValue}
              onChange={(event) => setUrlValue(event.target.value)}
            />
            {importProgress && (
              <div className="progress">
                {importProgress.message}
                {importProgress.percent != null ? ` ${Math.round(importProgress.percent)}%` : ''}
              </div>
            )}
            <div className="modal-actions">
              <button className="ghost" onClick={() => setUrlOpen(false)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={async () => {
                  try {
                    await window.shockwave.importUrl(urlValue)
                    setUrlValue('')
                    setUrlOpen(false)
                    setImportProgress(null)
                  } catch {
                    /* progress event already carries the error */
                  }
                }}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="modal-back" onClick={() => setCreateOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>Create playlist</h2>
            <input
              autoFocus
              placeholder="My playlist"
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.target.value)}
            />
            <div className="modal-actions">
              <button className="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={async () => {
                  await window.shockwave.createPlaylist(newPlaylistName || 'New playlist')
                  setNewPlaylistName('')
                  setCreateOpen(false)
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {menu && (
        <div className="menu" style={{ left: menu.x, top: menu.y }}>
          {state.playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => {
                void window.shockwave.addToPlaylist(playlist.id, menu.trackId)
                setMenu(null)
              }}
            >
              Add to {playlist.name}
            </button>
          ))}
          <button
            className="danger-item"
            onClick={() => {
              const track = state.tracks.find((item) => item.id === menu.trackId)
              if (track) setPendingDelete(track)
              setMenu(null)
            }}
          >
            Delete song
          </button>
        </div>
      )}

      {pendingDelete && (
        <div className="modal-back" onClick={() => setPendingDelete(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>Delete this song?</h2>
            <p>
              <strong>{pendingDelete.title}</strong> by {pendingDelete.artist} will be moved to the
              Recycle Bin. You can restore it from there if you change your mind.
            </p>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
              <button
                className="danger"
                onClick={async () => {
                  const id = pendingDelete.id
                  removeFromQueue(id)
                  await window.shockwave.deleteTrack(id)
                  setPendingDelete(null)
                }}
              >
                Move to Recycle Bin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TrackTable({
  tracks,
  currentId,
  likedSet,
  playList,
  onLike,
  onMenu,
  onDelete
}: {
  tracks: Track[]
  currentId?: string
  likedSet: Set<string>
  playList: (tracks: Track[], index: number) => void
  onLike: (id: string) => void
  onMenu: (menu: { x: number; y: number; trackId: string }) => void
  onDelete: (track: Track) => void
}): JSX.Element {
  if (tracks.length === 0) {
    return <p className="empty">Nothing here yet.</p>
  }
  return (
    <table className="track-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Title</th>
          <th>Album</th>
          <th></th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        {tracks.map((track, index) => (
          <tr
            key={track.id}
            className={`row ${currentId === track.id ? 'playing' : ''}`}
            onDoubleClick={() => playList(tracks, index)}
            onContextMenu={(event) => {
              event.preventDefault()
              onMenu({ x: event.clientX, y: event.clientY, trackId: track.id })
            }}
          >
            <td className="row-index">
              <span className="row-play" onClick={() => playList(tracks, index)}>
                <Icons.Play />
              </span>
              <span className="index-num">{index + 1}</span>
            </td>
            <td>
              <div className="track-cell">
                <div className="cover-sm">
                  {coverUrl(track) ? <img src={coverUrl(track)} alt="" /> : <Icons.Note />}
                </div>
                <div>
                  <div className="row-title">{track.title}</div>
                  <div className="row-sub">{track.artist}</div>
                </div>
              </div>
            </td>
            <td className="row-sub">{track.album}</td>
            <td>
              <div className="row-actions">
                <button className={`heart ${likedSet.has(track.id) ? 'liked' : ''}`} onClick={() => onLike(track.id)}>
                  <Icons.Heart filled={likedSet.has(track.id)} />
                </button>
                <button
                  className="row-delete"
                  title="Delete song"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(track)
                  }}
                >
                  <Icons.Trash />
                </button>
              </div>
            </td>
            <td className="duration">{formatTime(track.duration)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
