import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(process.env.LOCALAPPDATA ?? '', 'Android', 'sdk', 'platform-tools')
const names = ['adb.exe', 'AdbWinApi.dll', 'AdbWinUsbApi.dll', 'libwinpthread-1.dll']
const missing = names.filter((name) => !existsSync(join(source, name)))
if (missing.length > 0) {
  throw new Error(`Android platform-tools are missing ${missing.join(', ')} in ${source}`)
}

const dest = join(root, 'resources', 'platform-tools')
mkdirSync(dest, { recursive: true })
for (const name of names) {
  copyFileSync(join(source, name), join(dest, name))
}
