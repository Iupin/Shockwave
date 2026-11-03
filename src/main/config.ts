import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface UserConfig {
  repositoryPath: string | null
}

const DEFAULT_CONFIG: UserConfig = {
  repositoryPath: null
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
      repositoryPath: typeof parsed.repositoryPath === 'string' ? parsed.repositoryPath : null
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function writeUserConfig(config: UserConfig): void {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf8')
}
