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

interface ItunesResponse {
  resultCount?: number
  results?: Array<{
    trackName?: string
    artistName?: string
    collectionName?: string
    releaseDate?: string
    artworkUrl100?: string
  }>
}

const JUNK =
  /\b((official\s*)?(music\s*)?video|official\s*audio|lyrics?|visuali[sz]er|audio|hd|4k|topic|remastered)\b/gi

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
  return left === right || left.includes(right) || right.includes(left)
}

function artistsFromInfo(info: YtDlpInfo): string | undefined {
  if (typeof info.artist === 'string' && info.artist.trim()) return info.artist.trim()
  if (Array.isArray(info.artists) && info.artists.length) {
    return info.artists
      .map((item) => (typeof item === 'string' ? item : item.name))
      .filter((name): name is string => Boolean(name?.trim()))
      .join(', ')
  }
  return undefined
}

function bestYoutubeThumb(info: YtDlpInfo): string | undefined {
  const ranked = [...(info.thumbnails ?? [])]
    .filter((item) => item.url && !item.url.includes('storyboard') && !item.url.includes('/an_webp/'))
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))
  return ranked[0]?.url ?? info.thumbnail
}

function parseTitle(rawTitle: string): { title: string; artist?: string } {
  const cleaned = rawTitle.replace(JUNK, ' ').replace(/\s+/g, ' ').trim()
  const parts = cleaned.split(/\s[-–—]\s/)
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() }
  }
  const by = cleaned.match(/^(.*)\s+by\s+(.+)$/i)
  if (by) return { title: by[1].trim(), artist: by[2].trim() }
  return { title: cleaned }
}

export function identityFromVideo(info: YtDlpInfo): SongIdentity {
  const track = info.track?.trim()
  const artist = artistsFromInfo(info)
  if (track && artist) {
    return {
      title: track,
      artist,
      album: info.album?.trim() || undefined,
      year: info.release_year,
      thumbnailUrl: bestYoutubeThumb(info),
      official: true
    }
  }

  const parsed = parseTitle(info.title ?? '')
  return {
    title: parsed.title || info.title || 'Unknown title',
    artist: parsed.artist || info.uploader || info.channel || 'Unknown artist',
    album: info.album?.trim() || undefined,
    year: info.release_year,
    thumbnailUrl: bestYoutubeThumb(info),
    official: Boolean(parsed.artist)
  }
}

function itunesArt(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.replace(/100x100bb/, '600x600bb').replace(/100x100/, '600x600')
}

async function searchItunes(term: string): Promise<ItunesResponse> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=8`
  return fetchJson<ItunesResponse>(url)
}

export async function enrichFromItunes(identity: SongIdentity): Promise<SongIdentity> {
  const terms = [`${identity.artist} ${identity.title}`.trim(), identity.title.trim()].filter(
    (term, index, all) => term && all.indexOf(term) === index
  )
  if (terms.length === 0) return identity
  try {
    const data: ItunesResponse = { results: [] }
    for (const term of terms) {
      const page = await searchItunes(term)
      data.results = [...(data.results ?? []), ...(page.results ?? [])]
    }
    let best:
      | {
          score: number
          title: string
          artist: string
          album?: string
          year?: number
          artwork?: string
        }
      | undefined

    for (const result of data.results ?? []) {
      if (!result.trackName || !result.artistName) continue
      let score = 0
      if (similar(result.trackName, identity.title)) score += 4
      if (similar(result.artistName, identity.artist)) score += 4
      if (identity.album && result.collectionName && similar(result.collectionName, identity.album)) score += 1
      if (score < 5) continue
      if (!best || score > best.score) {
        const year = result.releaseDate ? Number(result.releaseDate.slice(0, 4)) : undefined
        best = {
          score,
          title: result.trackName,
          artist: result.artistName,
          album: result.collectionName,
          year: Number.isFinite(year) ? year : undefined,
          artwork: itunesArt(result.artworkUrl100)
        }
      }
    }

    if (!best) return identity
    return {
      title: best.title,
      artist: best.artist,
      album: best.album ?? identity.album,
      year: best.year ?? identity.year,
      thumbnailUrl: best.artwork ?? identity.thumbnailUrl,
      official: true
    }
  } catch {
    return identity
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
