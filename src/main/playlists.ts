import { randomUUID } from 'crypto'
import { existsSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { Playlist } from '../shared/types'
import { RepositoryLayout, readJson, writeJson } from './repository'

function playlistPath(layout: RepositoryLayout, id: string): string {
  return join(layout.playlists, `${id}.json`)
}

export function loadPlaylists(layout: RepositoryLayout): Playlist[] {
  if (!existsSync(layout.playlists)) {
    return []
  }
  const playlists = readdirSync(layout.playlists)
    .filter((name) => name.endsWith('.json'))
    .map((name) => readJson<Playlist | null>(join(layout.playlists, name), null))
    .filter((item): item is Playlist => Boolean(item?.id && item.name))

  playlists.sort((a, b) => {
    if (a.system === 'liked') return -1
    if (b.system === 'liked') return 1
    return a.name.localeCompare(b.name)
  })
  return playlists
}

export function savePlaylist(layout: RepositoryLayout, playlist: Playlist): void {
  writeJson(playlistPath(layout, playlist.id), playlist)
}

export function createPlaylist(layout: RepositoryLayout, name: string): Playlist {
  const playlist: Playlist = {
    id: randomUUID(),
    name: name.trim() || 'New playlist',
    trackIds: [],
    createdAt: new Date().toISOString()
  }
  savePlaylist(layout, playlist)
  return playlist
}

export function addToPlaylist(layout: RepositoryLayout, playlistId: string, trackId: string): Playlist | null {
  const playlist = readJson<Playlist | null>(playlistPath(layout, playlistId), null)
  if (!playlist) return null
  if (!playlist.trackIds.includes(trackId)) {
    playlist.trackIds.push(trackId)
    savePlaylist(layout, playlist)
  }
  return playlist
}

export function removeFromPlaylist(
  layout: RepositoryLayout,
  playlistId: string,
  trackId: string
): Playlist | null {
  const playlist = readJson<Playlist | null>(playlistPath(layout, playlistId), null)
  if (!playlist) return null
  playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId)
  savePlaylist(layout, playlist)
  return playlist
}

export function toggleLiked(layout: RepositoryLayout, trackId: string): Playlist {
  const liked =
    readJson<Playlist | null>(playlistPath(layout, 'liked'), null) ??
    ({
      id: 'liked',
      name: 'Liked Songs',
      trackIds: [],
      createdAt: new Date().toISOString(),
      system: 'liked'
    } satisfies Playlist)

  if (liked.trackIds.includes(trackId)) {
    liked.trackIds = liked.trackIds.filter((id) => id !== trackId)
  } else {
    liked.trackIds.push(trackId)
  }
  savePlaylist(layout, liked)
  return liked
}

export function deletePlaylist(layout: RepositoryLayout, playlistId: string): boolean {
  if (playlistId === 'liked') return false
  const file = playlistPath(layout, playlistId)
  if (!existsSync(file)) return false
  unlinkSync(file)
  return true
}
