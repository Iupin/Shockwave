import { deflateSync } from 'zlib'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'build')
mkdirSync(outDir, { recursive: true })

function crc32(buffer) {
  let crc = ~0
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i]
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(data.length, 0)
  header.write(type, 4)
  const crcBuf = Buffer.concat([header.subarray(4), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcBuf), 0)
  return Buffer.concat([header, data, crc])
}

function encodePng(size, paint) {
  const pixels = Buffer.alloc(size * size * 4, 0)
  paint(pixels, size)
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function setPixel(pixels, size, x, y, r, g, b, a = 255) {
  const ix = Math.round(x)
  const iy = Math.round(y)
  if (ix < 0 || iy < 0 || ix >= size || iy >= size) return
  const i = (iy * size + ix) * 4
  const srcA = a / 255
  const dstA = pixels[i + 3] / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA <= 0) return
  pixels[i] = Math.round((r * srcA + pixels[i] * dstA * (1 - srcA)) / outA)
  pixels[i + 1] = Math.round((g * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA)
  pixels[i + 2] = Math.round((b * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA)
  pixels[i + 3] = Math.round(outA * 255)
}

function fillRounded(pixels, size, color) {
  const radius = size * 0.22
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.max(radius - x, 0, x - (size - radius))
      const dy = Math.max(radius - y, 0, y - (size - radius))
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(pixels, size, x, y, ...color)
      }
    }
  }
}

function drawWave(pixels, size, yRatio, ampRatio, thicknessRatio, cycles) {
  const pad = size * 0.16
  const y0 = size * yRatio
  const amp = size * ampRatio
  const thickness = Math.max(1.2, size * thicknessRatio)
  for (let x = pad; x <= size - pad; x += 0.35) {
    const t = ((x - pad) / (size - pad * 2)) * Math.PI * 2 * cycles
    const y = y0 + Math.sin(t) * amp
    for (let oy = -thickness; oy <= thickness; oy += 0.4) {
      for (let ox = -thickness; ox <= thickness; ox += 0.4) {
        if (ox * ox + oy * oy <= thickness * thickness) {
          const edge = 1 - Math.sqrt(ox * ox + oy * oy) / thickness
          setPixel(pixels, size, x + ox, y + oy, 30, 215, 96, Math.round(255 * Math.min(1, edge * 1.4)))
        }
      }
    }
  }
}

function paint(pixels, size) {
  fillRounded(pixels, size, [0, 0, 0, 255])
  drawWave(pixels, size, 0.46, 0.16, 0.038, 1.15)
  drawWave(pixels, size, 0.64, 0.1, 0.028, 1.15)
}

function encodeIco(pngs) {
  const count = pngs.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)
  const entries = []
  let offset = 6 + 16 * count
  const bodies = []
  for (const { size, png } of pngs) {
    const entry = Buffer.alloc(16)
    entry[0] = size === 256 ? 0 : size
    entry[1] = size === 256 ? 0 : size
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    bodies.push(png)
    offset += png.length
  }
  return Buffer.concat([header, ...entries, ...bodies])
}

const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = sizes.map((size) => ({ size, png: encodePng(size, paint) }))
writeFileSync(join(outDir, 'icon.png'), pngs.find((item) => item.size === 256).png)
writeFileSync(join(outDir, 'icon.ico'), encodeIco(pngs))
writeFileSync(
  join(outDir, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="5" fill="#000"/>
  <path d="M3 12c2.5-6 5.5-6 8 0s5.5 6 8 0" fill="none" stroke="#1ed760" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M5 16c2-4 4-4 6 0s4 4 6 0" fill="none" stroke="#1ed760" stroke-width="2" stroke-linecap="round"/>
</svg>`
)
console.log('Wrote build/icon.png, build/icon.ico, build/icon.svg')
