import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface UserConfig {
  repositoryPath: string | null
  lastSeenVersion: string | null
  discordRichPresence: boolean
  aftershockInstalled: boolean
  aftershockPromptSeen: boolean
}

const DEFAULT_CONFIG: UserConfig = {
  repositoryPath: null,
  lastSeenVersion: null,
  discordRichPresence: true,
  aftershockInstalled: false,
  aftershockPromptSeen: false
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

export function readUserConfig(): UserConfig {
  const file = configPath()
  if (!existsSync(file)) {
    return { ...DEFAULT_CONFIG }
  }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<UserConfig>
    return {
      repositoryPath: typeof parsed.repositoryPath === 'string' ? parsed.repositoryPath : null,
      lastSeenVersion: typeof parsed.lastSeenVersion === 'string' ? parsed.lastSeenVersion : null,
      discordRichPresence: parsed.discordRichPresence !== false,
      aftershockInstalled: parsed.aftershockInstalled === true,
      aftershockPromptSeen: parsed.aftershockPromptSeen === true
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function writeUserConfig(patch: Partial<UserConfig>): void {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const config = { ...readUserConfig(), ...patch }
  writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf8')
}
