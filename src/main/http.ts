import { get as httpsGet } from 'https'
import { get as httpGet } from 'http'

export function fetchBuffer(
  url: string,
  redirects = 0,
  extraHeaders: Record<string, string> = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('http://') ? httpGet : httpsGet
    get(url, { headers: { 'User-Agent': 'Shockwave/1.5.0', ...extraHeaders } }, (response) => {
      const status = response.statusCode ?? 0
      if (status >= 300 && status < 400 && response.headers.location && redirects < 5) {
        fetchBuffer(response.headers.location, redirects + 1, extraHeaders).then(resolve, reject)
        return
      }
      if (status !== 200) {
        reject(new Error(`Request failed (${status})`))
        return
      }
      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    }).on('error', reject)
  })
}

export async function fetchJson<T>(url: string, extraHeaders: Record<string, string> = {}): Promise<T> {
  const buffer = await fetchBuffer(url, 0, extraHeaders)
  return JSON.parse(buffer.toString('utf8')) as T
}
