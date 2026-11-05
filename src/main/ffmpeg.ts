import { existsSync } from 'fs'
import { join } from 'path'

const executable = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

export function ffmpegDir(): string | null {
  const candidates: string[] = []
  if (typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0) {
    candidates.push(join(process.resourcesPath, 'ffmpeg'))
  }
  candidates.push(join(process.cwd(), 'resources', 'ffmpeg'))
  return candidates.find((dir) => existsSync(join(dir, executable))) ?? null
}

export function ffmpegBinary(): string {
  const dir = ffmpegDir()
  return dir ? join(dir, executable) : executable
}
