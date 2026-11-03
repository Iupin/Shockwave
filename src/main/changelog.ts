import { app } from 'electron'
import { ChangelogPayload, ReleaseNotes } from '../shared/types'
import { readUserConfig, writeUserConfig } from './config'
import { fetchJson } from './http'

interface GithubRelease {
  tag_name?: string
  name?: string
  body?: string
  html_url?: string
  published_at?: string
  draft?: boolean
  prerelease?: boolean
}

function parseVersion(value: string): number[] {
  return value
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part.replace(/[^\d].*$/, ''), 10) || 0)
}

export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  const len = Math.max(left.length, right.length)
  for (let i = 0; i < len; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

export function rememberCurrentVersion(): void {
  const current = app.getVersion()
  const config = readUserConfig()
  if (!config.lastSeenVersion) {
    writeUserConfig({ lastSeenVersion: current })
  }
}

export function dismissChangelog(): void {
  writeUserConfig({ lastSeenVersion: app.getVersion() })
}

export async function pendingChangelog(): Promise<ChangelogPayload | null> {
  const current = app.getVersion()
  const lastSeen = readUserConfig().lastSeenVersion
  if (!lastSeen) {
    writeUserConfig({ lastSeenVersion: current })
    return null
  }
  if (compareVersions(current, lastSeen) <= 0) {
    return null
  }

  try {
    const releases = await fetchJson<GithubRelease[]>(
      'https://api.github.com/repos/Iupin/Shockwave/releases?per_page=20',
      { Accept: 'application/vnd.github+json' }
    )
    const notes: ReleaseNotes[] = releases
      .filter((release) => !release.draft && release.tag_name)
      .filter((release) => {
        const version = release.tag_name as string
        return compareVersions(version, lastSeen) > 0 && compareVersions(version, current) <= 0
      })
      .map((release) => ({
        version: (release.tag_name ?? '').replace(/^v/i, ''),
        title: release.name?.trim() || release.tag_name || current,
        body: release.body?.trim() || 'No release notes were provided for this version.',
        url: release.html_url || 'https://github.com/Iupin/Shockwave/releases',
        publishedAt: release.published_at
      }))

    if (notes.length === 0) {
      notes.push({
        version: current,
        title: `Shockwave ${current}`,
        body: 'Updated successfully. Open GitHub Releases for the full notes.',
        url: 'https://github.com/Iupin/Shockwave/releases'
      })
    }

    return { fromVersion: lastSeen, toVersion: current, releases: notes }
  } catch {
    return {
      fromVersion: lastSeen,
      toVersion: current,
      releases: [
        {
          version: current,
          title: `Shockwave ${current}`,
          body: 'Updated successfully, but release notes could not be loaded right now.',
          url: 'https://github.com/Iupin/Shockwave/releases'
        }
      ]
    }
  }
}
