import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

export interface AftershockPackage {
  version: string
  build: number
  filePath: string
  size: number
}

function packageDirs(): string[] {
  const dirs: string[] = []
  if (typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0) {
    dirs.push(join(process.resourcesPath, 'aftershock'))
  }
  dirs.push(join(process.cwd(), 'resources', 'aftershock'))
  return dirs
}

export function bundledAftershock(): AftershockPackage | null {
  for (const dir of packageDirs()) {
    const versionFile = join(dir, 'version.json')
    const filePath = join(dir, 'Aftershock.apk')
    if (!existsSync(versionFile) || !existsSync(filePath)) continue
    try {
      const parsed = JSON.parse(readFileSync(versionFile, 'utf8')) as { version?: unknown; build?: unknown }
      if (typeof parsed.version !== 'string' || parsed.version.trim().length === 0) continue
      if (typeof parsed.build !== 'number' || !Number.isInteger(parsed.build) || parsed.build <= 0) continue
      return { version: parsed.version, build: parsed.build, filePath, size: statSync(filePath).size }
    } catch {
      continue
    }
  }
  return null
}

export function newerAftershock(
  phoneBuild: number | undefined,
  packaged: AftershockPackage | null
): AftershockPackage | null {
  if (!packaged) return null
  return packaged.build > (phoneBuild ?? 0) ? packaged : null
}
