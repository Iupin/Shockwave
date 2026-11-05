import { spawnSync } from 'child_process'
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
import { get } from 'https'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dest = join(root, 'resources', 'ffmpeg')
const ffmpeg = join(dest, 'ffmpeg.exe')
const ffprobe = join(dest, 'ffprobe.exe')
const source =
  'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'

function ready(file) {
  return existsSync(file) && statSync(file).size > 1_000_000
}

function download(url, file) {
  return new Promise((resolve, reject) => {
    const request = (target, hops) => {
      get(target, { headers: { 'User-Agent': 'Shockwave' } }, (response) => {
        const status = response.statusCode ?? 0
        if (status >= 300 && status < 400 && response.headers.location && hops < 5) {
          request(response.headers.location, hops + 1)
          return
        }
        if (status !== 200) {
          reject(new Error(`Failed to download ffmpeg (${status})`))
          response.resume()
          return
        }
        const stream = createWriteStream(file)
        response.pipe(stream)
        stream.on('finish', () => stream.close(resolve))
        stream.on('error', reject)
      }).on('error', reject)
    }
    request(url, 0)
  })
}

function findBinary(dir, name) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findBinary(path, name)
      if (found) return found
    } else if (entry.name.toLowerCase() === name) {
      return path
    }
  }
  return null
}

if (ready(ffmpeg) && ready(ffprobe)) {
  console.log('ffmpeg already staged')
} else {
  mkdirSync(dest, { recursive: true })
  const work = join(tmpdir(), 'shockwave-ffmpeg')
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  const zip = join(work, 'ffmpeg.zip')
  console.log('Downloading ffmpeg…')
  await download(source, zip)
  const extracted = spawnSync('tar', ['-xf', zip, '-C', work], { stdio: 'inherit' })
  if (extracted.status !== 0) throw new Error('Could not unpack ffmpeg')
  const ffmpegSrc = findBinary(work, 'ffmpeg.exe')
  const ffprobeSrc = findBinary(work, 'ffprobe.exe')
  if (!ffmpegSrc || !ffprobeSrc) throw new Error('The ffmpeg download did not include ffmpeg.exe and ffprobe.exe')
  copyFileSync(ffmpegSrc, ffmpeg)
  copyFileSync(ffprobeSrc, ffprobe)
  if (!ready(ffmpeg) || !ready(ffprobe)) throw new Error('Could not stage ffmpeg.exe and ffprobe.exe')
  rmSync(work, { recursive: true, force: true })
  console.log('Staged ffmpeg')
}
