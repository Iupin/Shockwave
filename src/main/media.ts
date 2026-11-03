import { createReadStream, statSync } from 'fs'
import { extname } from 'path'
import { Readable } from 'stream'

const MIME: Record<string, string> = {
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.aac': 'audio/aac',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.wma': 'audio/x-ms-wma',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}

function parseRange(header: string | null, size: number): { start: number; end: number; partial: boolean } | null {
  if (!header) return { start: 0, end: size - 1, partial: false }
  const match = /bytes=(\d*)-(\d*)/.exec(header)
  if (!match) return { start: 0, end: size - 1, partial: false }
  const start = match[1] ? Number(match[1]) : 0
  const end = match[2] ? Number(match[2]) : size - 1
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return null
  }
  return { start, end: Math.min(end, size - 1), partial: true }
}

export function fileResponse(filePath: string, request: Request): Response {
  const stats = statSync(filePath)
  const mime = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  const range = parseRange(request.headers.get('range'), stats.size)
  if (!range) {
    return new Response(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${stats.size}`,
        'Accept-Ranges': 'bytes'
      }
    })
  }

  const stream = Readable.toWeb(createReadStream(filePath, { start: range.start, end: range.end })) as ReadableStream
  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Content-Length': String(range.end - range.start + 1),
    'Accept-Ranges': 'bytes'
  }
  if (range.partial) {
    headers['Content-Range'] = `bytes ${range.start}-${range.end}/${stats.size}`
  }
  return new Response(stream, { status: range.partial ? 206 : 200, headers })
}
