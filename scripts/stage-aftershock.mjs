import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pubspec = readFileSync(join(root, 'android app', 'pubspec.yaml'), 'utf8')
const match = pubspec.match(/^version:\s*(\d+\.\d+\.\d+)\+(\d+)\s*$/m)
if (!match) throw new Error('Aftershock pubspec is missing a version like 1.1.0+2')

const apk = join(root, 'android app', 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk')
if (!existsSync(apk)) {
  throw new Error('Build the Aftershock release APK before packaging Shockwave')
}

const dest = join(root, 'resources', 'aftershock')
mkdirSync(dest, { recursive: true })
copyFileSync(apk, join(dest, 'Aftershock.apk'))
writeFileSync(
  join(dest, 'version.json'),
  `${JSON.stringify({ version: match[1], build: Number(match[2]) }, null, 2)}\n`
)
