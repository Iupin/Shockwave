import { fetchBuffer, fetchJson } from './http'

export interface SongIdentity {
  title: string
  artist: string
  album?: string
  year?: number
  thumbnailUrl?: string
  official: boolean
}

interface YtThumbnail {
  url?: string
  width?: number
  height?: number
}

export interface YtDlpInfo {
  id?: string
  title?: string
  track?: string
  artist?: string
  artists?: Array<string | { name?: string }>
  album?: string
  album_artist?: string
  release_year?: number
  uploader?: string
  channel?: string
  thumbnails?: YtThumbnail[]
  thumbnail?: string
  webpage_url_domain?: string
}

interface CatalogHit {
  title: string
  artist: string
  album?: string
  year?: number
  artwork?: string
  score: number
}

interface ItunesResponse {
  results?: Array<{
    trackName?: string
    artistName?: string
    collectionName?: string
    releaseDate?: string
    artworkUrl100?: string
    collectionArtistName?: string
  }>
}

interface DeezerResponse {
  data?: Array<{
    title?: string
    artist?: { name?: string }
    album?: { title?: string; cover_xl?: string; cover_big?: string }
  }>
}

interface MusicBrainzResponse {
  recordings?: Array<{
    title?: string
    'artist-credit'?: Array<{ name?: string; artist?: { name?: string } }>
    releases?: Array<{
      id?: string
      title?: string
      date?: string
      'release-group'?: { id?: string; 'primary-type'?: string }
    }>
  }>
}

const JUNK =
  /\b((official\s*)?(music\s*)?video|official\s*audio|lyrics?|visuali[sz]er|audio|hd|4k|topic|remastered|vevo)\b/gi

const MB_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Shockwave/1.6.13 (https://github.com/Iupin/Shockwave)'
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(JUNK, ' ')
    .replace(/\b(feat|ft|featuring)\.?\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function similar(a: string, b: string): boolean {
  const left = normalize(a)
  const right = normalize(b)
  if (!left || !right) return false
  if (left === right || left.includes(right) || right.includes(left)) return true
  const ta = new Set(left.split(' ').filter((token) => token.length > 1))
  const tb = new Set(right.split(' ').filter((token) => token.length > 1))
  if (ta.size === 0 || tb.size === 0) return false
  let inter = 0
  for (const token of ta) if (tb.has(token)) inter += 1
  return inter / Math.max(ta.size, tb.size) >= 0.6
}

function matchScore(hit: { title: string; artist: string; album?: string }, identity: SongIdentity): number {
  let score = 0
  if (similar(hit.title, identity.title)) score += 4
  if (similar(hit.artist, identity.artist)) score += 4
  if (identity.album && hit.album && similar(hit.album, identity.album)) score += 2
  const album = hit.album?.toLowerCase() ?? ''
  if (album.includes('karaoke') || album.includes('tribute') || album.includes('cover')) score -= 3
  return score
}

function cleanArtist(value: string): string {
  return value
    .replace(/\s*-\s*topic$/i, '')
    .replace(/\s*vevo$/i, '')
    .replace(/\s*official$/i, '')
    .replace(JUNK, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanTitle(value: string): string {
  return value
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(JUNK, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function artistsFromInfo(info: YtDlpInfo): string | undefined {
  if (typeof info.artist === 'string' && info.artist.trim()) return cleanArtist(info.artist)
  if (Array.isArray(info.artists) && info.artists.length) {
    return info.artists
      .map((item) => (typeof item === 'string' ? item : item.name))
      .filter((name): name is string => Boolean(name?.trim()))
      .map(cleanArtist)
      .join(', ')
  }
  return undefined
}

function parseTitle(rawTitle: string): { title: string; artist?: string } {
  const cleaned = cleanTitle(rawTitle)
  const parts = cleaned.split(/\s[-–—]\s/)
  if (parts.length >= 2) {
    return { artist: cleanArtist(parts[0]), title: cleanTitle(parts.slice(1).join(' - ')) }
  }
  const by = cleaned.match(/^(.*)\s+by\s+(.+)$/i)
  if (by) return { title: cleanTitle(by[1]), artist: cleanArtist(by[2]) }
  return { title: cleaned }
}

export function identityFromVideo(info: YtDlpInfo): SongIdentity {
  const track = info.track?.trim()
  const artist = artistsFromInfo(info)
  if (track && artist) {
    return {
      title: cleanTitle(track) || track,
      artist,
      album: info.album?.trim() || undefined,
      year: info.release_year,
      official: true
    }
  }

  const parsed = parseTitle(info.title ?? '')
  return {
    title: parsed.title || info.title || 'Unknown title',
    artist: parsed.artist || cleanArtist(info.uploader || info.channel || '') || 'Unknown artist',
    album: info.album?.trim() || undefined,
    year: info.release_year,
    official: Boolean(parsed.artist)
  }
}

function itunesArt(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.replace(/100x100bb/, '600x600bb').replace(/100x100/, '600x600')
}

async function lookupItunes(identity: SongIdentity): Promise<CatalogHit[]> {
  const term = `${identity.artist} ${identity.title}`.trim()
  if (!term) return []
  try {
    const data = await fetchJson<ItunesResponse>(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=25`
    )
    return (data.results ?? [])
      .filter((result) => result.trackName && result.artistName)
      .map((result) => ({
        title: result.trackName as string,
        artist: result.artistName as string,
        album: result.collectionName,
        year: result.releaseDate ? Number(result.releaseDate.slice(0, 4)) : undefined,
        artwork: itunesArt(result.artworkUrl100),
        score: matchScore(
          {
            title: result.trackName as string,
            artist: result.artistName as string,
            album: result.collectionName
          },
          identity
        )
      }))
  } catch {
    return []
  }
}

async function lookupDeezer(identity: SongIdentity): Promise<CatalogHit[]> {
  const term = `artist:"${identity.artist}" track:"${identity.title}"`
  try {
    const data = await fetchJson<DeezerResponse>(
      `https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=15`
    )
    const hits = (data.data ?? []).map((result) => ({
      title: result.title ?? '',
      artist: result.artist?.name ?? '',
      album: result.album?.title,
      artwork: result.album?.cover_xl || result.album?.cover_big,
      score: matchScore(
        {
          title: result.title ?? '',
          artist: result.artist?.name ?? '',
          album: result.album?.title
        },
        identity
      )
    }))
    if (hits.length > 0) return hits
    const fallback = await fetchJson<DeezerResponse>(
      `https://api.deezer.com/search?q=${encodeURIComponent(`${identity.artist} ${identity.title}`)}&limit=15`
    )
    return (fallback.data ?? []).map((result) => ({
      title: result.title ?? '',
      artist: result.artist?.name ?? '',
      album: result.album?.title,
      artwork: result.album?.cover_xl || result.album?.cover_big,
      score: matchScore(
        {
          title: result.title ?? '',
          artist: result.artist?.name ?? '',
          album: result.album?.title
        },
        identity
      )
    }))
  } catch {
    return []
  }
}

async function lookupMusicBrainz(identity: SongIdentity): Promise<CatalogHit[]> {
  const query = `recording:"${identity.title}" AND artist:"${identity.artist}"`
  try {
    const data = await fetchJson<MusicBrainzResponse>(
      `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=5`,
      MB_HEADERS
    )
    const hits: CatalogHit[] = []
    for (const recording of data.recordings ?? []) {
      const artist =
        recording['artist-credit']?.map((credit) => credit.name || credit.artist?.name).filter(Boolean).join(', ') ??
        identity.artist
      const releases = recording.releases ?? []
      const studio = releases.find((release) => release['release-group']?.['primary-type'] === 'Album') ?? releases[0]
      if (!recording.title) continue
      let artwork: string | undefined
      const coverId = studio?.id || studio?.['release-group']?.id
      if (studio?.id) {
        artwork = `https://coverartarchive.org/release/${studio.id}/front-500`
      } else if (studio?.['release-group']?.id) {
        artwork = `https://coverartarchive.org/release-group/${studio['release-group'].id}/front-500`
      }
      hits.push({
        title: recording.title,
        artist,
        album: studio?.title,
        year: studio?.date ? Number(studio.date.slice(0, 4)) : undefined,
        artwork,
        score: matchScore({ title: recording.title, artist, album: studio?.title }, identity) + (coverId ? 1 : 0)
      })
    }
    return hits
  } catch {
    return []
  }
}

function pickBest(identity: SongIdentity, hits: CatalogHit[]): CatalogHit | undefined {
  return hits
    .filter((hit) => hit.score >= 6 && hit.title && hit.artist)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const aArt = a.artwork ? 1 : 0
      const bArt = b.artwork ? 1 : 0
      if (bArt !== aArt) return bArt - aArt
      const aAlbum = a.album ? 1 : 0
      const bAlbum = b.album ? 1 : 0
      return bAlbum - aAlbum
    })[0]
}

export async function enrichSong(identity: SongIdentity): Promise<SongIdentity> {
  const seed: SongIdentity = {
    ...identity,
    title: cleanTitle(identity.title) || identity.title,
    artist: cleanArtist(identity.artist) || identity.artist
  }

  const hits = [
    ...(await lookupItunes(seed)),
    ...(await lookupDeezer(seed))
  ]
  let best = pickBest(seed, hits)
  if (!best?.album || !best.artwork) {
    const mb = await lookupMusicBrainz(best ? { ...seed, title: best.title, artist: best.artist } : seed)
    const mbBest = pickBest(seed, mb)
    if (mbBest && (!best || mbBest.score >= best.score - 1)) {
      best = {
        ...(best ?? mbBest),
        album: best?.album || mbBest.album,
        artwork: best?.artwork || mbBest.artwork,
        year: best?.year || mbBest.year,
        title: best?.title || mbBest.title,
        artist: best?.artist || mbBest.artist,
        score: Math.max(best?.score ?? 0, mbBest.score)
      }
    }
  }

  if (!best) return seed
  return {
    title: best.title,
    artist: best.artist,
    album: best.album ?? seed.album,
    year: best.year ?? seed.year,
    thumbnailUrl: best.artwork,
    official: true
  }
}

export async function downloadArtwork(url?: string): Promise<Buffer | null> {
  if (!url) return null
  try {
    const buffer = await fetchBuffer(url)
    return buffer.length > 32 ? buffer : null
  } catch {
    return null
  }
}
