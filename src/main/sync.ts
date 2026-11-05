import { randomUUID } from 'crypto'
import { createReadStream, createWriteStream, existsSync, readdirSync, statSync, unlinkSync } from 'fs'
import { createSocket, RemoteInfo } from 'dgram'
import { Socket, connect } from 'net'
import { hostname, networkInterfaces, tmpdir } from 'os'
import { extname, join } from 'path'
import { pipeline } from 'stream/promises'
import { createDeflateRaw } from 'zlib'
import { SyncStatus } from '../shared/types'
import { AftershockPackage, bundledAftershock, newerAftershock } from './aftershock-package'
import { loadLibrary, resolveTrackPath } from './library'
import { loadLyricsCache } from './lyrics'
import { loadPlaylists } from './playlists'
import { RepositoryLayout, loadSettings } from './repository'

const UDP_PORT = 47820

export interface AftershockDevice {
  id: string
  name: string
  address: string
  port: number
  version?: string
  build?: number
}

interface OutgoingFile {
  kind: 'audio' | 'cover'
  name: string
  path: string
  size: number
}

interface PackedFile extends OutgoingFile {
  rawSize: number
  storedSize: number
  encoding: 0 | 1
  cleanup?: string
}

const COMPRESSIBLE = new Set(['.wav', '.wave', '.aiff', '.aif', '.aifc'])

function broadcastTargets(): string[] {
  const targets = new Set(['255.255.255.255'])
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      const family = entry.family as string | number
      if ((family !== 'IPv4' && family !== 4) || entry.internal) continue
      const ip = entry.address.split('.').map((part) => Number(part))
      const mask = entry.netmask.split('.').map((part) => Number(part))
      if (ip.length !== 4 || mask.length !== 4 || mask.some((part) => Number.isNaN(part))) continue
      targets.add(ip.map((part, index) => (part | (~mask[index] & 255)) >>> 0).join('.'))
    }
  }
  return [...targets]
}

export function discoverAftershock(timeoutMs = 6000): Promise<AftershockDevice[]> {
  return new Promise((resolve) => {
    const found = new Map<string, AftershockDevice>()
    const socket = createSocket({ type: 'udp4', reuseAddr: true })
    let closed = false
    let probeTimer: ReturnType<typeof setInterval> | undefined
    const finish = (): void => {
      if (closed) return
      closed = true
      if (probeTimer) clearInterval(probeTimer)
      socket.close()
      resolve([...found.values()])
    }
    socket.on('error', finish)
    socket.on('message', (message: Buffer, rinfo: RemoteInfo) => {
      try {
        const data = JSON.parse(message.toString('utf8')) as {
          v?: number
          type?: string
          id?: string
          name?: string
          port?: number
          version?: unknown
          build?: unknown
        }
        if (data.v !== 1 || data.type !== 'hello') return
        const id = data.id || rinfo.address
        const build = typeof data.build === 'number' && Number.isInteger(data.build) ? data.build : undefined
        found.set(id, {
          id,
          name: data.name || 'Aftershock',
          address: rinfo.address,
          port: data.port && data.port > 0 ? data.port : 47821,
          version: typeof data.version === 'string' ? data.version : undefined,
          build
        })
      } catch {
        /* ignore unrelated packets */
      }
    })
    socket.bind(() => {
      socket.setBroadcast(true)
      const probe = Buffer.from(JSON.stringify({ v: 1, type: 'discover', name: 'Shockwave' }))
      const send = (): void => {
        for (const target of broadcastTargets()) {
          socket.send(probe, UDP_PORT, target)
        }
      }
      send()
      probeTimer = setInterval(send, 400)
      let armed = false
      socket.on('message', () => {
        if (armed || found.size === 0) return
        armed = true
        setTimeout(finish, 250)
      })
      setTimeout(finish, timeoutMs)
    })
  })
}

function openSocket(device: AftershockDevice): Promise<Socket> {
  const socket = connect({ host: device.address, port: device.port })
  socket.setNoDelay(true)
  return new Promise((resolve, reject) => {
    const fail = (error: Error): void => {
      socket.off('connect', ready)
      socket.destroy()
      reject(error)
    }
    const ready = (): void => {
      socket.off('error', fail)
      resolve(socket)
    }
    socket.once('error', fail)
    socket.once('connect', ready)
  })
}

function splitLanes(files: PackedFile[], lanes: number): PackedFile[][] {
  if (files.length === 0) return []
  const count = Math.max(1, Math.min(lanes, files.length))
  const groups: PackedFile[][] = Array.from({ length: count }, () => [])
  const load = Array.from({ length: count }, () => 0)
  const ordered = [...files].sort((a, b) => b.storedSize - a.storedSize)
  for (const file of ordered) {
    let target = 0
    for (let index = 1; index < count; index += 1) {
      if (load[index] < load[target]) target = index
    }
    groups[target].push(file)
    load[target] += file.storedSize
  }
    return groups.filter((group) => group.length > 0)
  }

function sendingLabel(pending: OutgoingFile[]): string {
  const songs = pending.filter((file) => file.kind === 'audio').length
  if (songs === 0) return 'Sending artwork'
  return songs === 1 ? 'Sending 1 song' : `Sending ${songs} songs`
}

function writeJson(socket: Socket, payload: unknown): Promise<void> {
  const json = Buffer.from(JSON.stringify(payload), 'utf8')
  const header = Buffer.alloc(4)
  header.writeUInt32BE(json.length, 0)
  return new Promise((resolve, reject) => {
    socket.write(Buffer.concat([header, json]), (error) => (error ? reject(error) : resolve()))
  })
}

function readExact(socket: Socket, size: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let got = 0
    const cleanup = (): void => {
      socket.off('data', onData)
      socket.off('error', onError)
      socket.off('close', onClose)
    }
    const onError = (error: Error): void => {
      cleanup()
      reject(error)
    }
    const onClose = (): void => {
      cleanup()
      reject(new Error('Aftershock closed the connection'))
    }
    const onData = (chunk: Buffer): void => {
      chunks.push(chunk)
      got += chunk.length
      if (got < size) return
      cleanup()
      const all = Buffer.concat(chunks)
      const extra = all.subarray(size)
      if (extra.length > 0) socket.unshift(extra)
      resolve(all.subarray(0, size))
    }
    socket.on('data', onData)
    socket.on('error', onError)
    socket.on('close', onClose)
  })
}

async function readJson(socket: Socket): Promise<Record<string, unknown>> {
  const length = (await readExact(socket, 4)).readUInt32BE(0)
  if (length <= 0 || length > 32 * 1024 * 1024) throw new Error('Unexpected reply from Aftershock')
  const data: unknown = JSON.parse((await readExact(socket, length)).toString('utf8'))
  if (!data || typeof data !== 'object') throw new Error('Unexpected reply from Aftershock')
  return data as Record<string, unknown>
}

function heldFiles(reply: Record<string, unknown>): Map<string, number> | null {
  if (!Array.isArray(reply.files)) return null
  const held = new Map<string, number>()
  for (const entry of reply.files) {
    if (!entry || typeof entry !== 'object') continue
    const file = entry as { kind?: unknown; name?: unknown; size?: unknown }
    if ((file.kind !== 'audio' && file.kind !== 'cover') || typeof file.name !== 'string') continue
    if (typeof file.size !== 'number' || !Number.isFinite(file.size)) continue
    held.set(`${file.kind}\0${file.name.replaceAll('\\', '/')}`, file.size)
  }
  return held
}

export function filesToSend(files: OutgoingFile[], held: Map<string, number> | null): OutgoingFile[] {
  if (!held) return files
  return files.filter((file) => held.get(`${file.kind}\0${file.name}`) !== file.size)
}

function sendFileWithProgress(socket: Socket, file: string, onBytes: (count: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(file, { highWaterMark: 1024 * 1024 })
    let settled = false
    const onDrain = (): void => {
      stream.resume()
    }
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      socket.off('error', fail)
      socket.off('drain', onDrain)
      if (error) {
        stream.destroy()
        reject(error)
        return
      }
      resolve()
    }
    const fail = (error: Error): void => finish(error)
    stream.on('data', (chunk: string | Buffer) => {
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
      onBytes(bytes.length)
      if (!socket.write(bytes)) stream.pause()
    })
    socket.on('drain', onDrain)
    stream.on('error', fail)
    socket.on('error', fail)
    stream.on('end', () => {
      if (socket.writableNeedDrain) socket.once('drain', () => finish())
      else finish()
    })
  })
}

function writeBuffer(socket: Socket, bytes: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = (error: Error): void => {
      socket.off('error', fail)
      socket.off('drain', done)
      reject(error)
    }
    const done = (): void => {
      socket.off('error', fail)
      resolve()
    }
    socket.on('error', fail)
    if (socket.write(bytes)) done()
    else socket.once('drain', done)
  })
}

function frameHeader(file: PackedFile): Buffer {
  const name = Buffer.from(file.name, 'utf8')
  if (name.length === 0 || name.length > 0xffff) throw new Error(`Cannot sync ${file.name}`)
  if (file.rawSize > 0xffffffff || file.storedSize > 0xffffffff) throw new Error(`${file.name} is too large to sync`)
  const header = Buffer.alloc(4 + name.length + 8)
  header.writeUInt8(file.encoding, 0)
  header.writeUInt8(file.kind === 'cover' ? 2 : 1, 1)
  header.writeUInt16BE(name.length, 2)
  name.copy(header, 4)
  header.writeUInt32BE(file.rawSize, 4 + name.length)
  header.writeUInt32BE(file.storedSize, 8 + name.length)
  return header
}

async function packFile(file: OutgoingFile): Promise<PackedFile> {
  const packed: PackedFile = { ...file, rawSize: file.size, storedSize: file.size, encoding: 0 }
  const ext = extname(file.name).toLowerCase()
  if (!COMPRESSIBLE.has(ext) || file.size < 4096 || file.size > 0xffffffff) return packed
  const dest = join(tmpdir(), `shockwave-${randomUUID()}.zlib`)
  try {
    await pipeline(createReadStream(file.path, { highWaterMark: 1024 * 1024 }), createDeflateRaw({ level: 1 }), createWriteStream(dest))
    const stored = statSync(dest).size
    if (stored >= file.size || stored > 0xffffffff) {
      unlinkSync(dest)
      return packed
    }
    return { ...packed, encoding: 1, storedSize: stored, path: dest, cleanup: dest }
  } catch {
    if (existsSync(dest)) unlinkSync(dest)
    return packed
  }
}

function releasePacked(packed: PackedFile[]): void {
  for (const file of packed) {
    if (!file.cleanup) continue
    try {
      unlinkSync(file.cleanup)
    } catch {
      // Temporary compression files are best-effort.
    }
  }
}

async function sendAftershockUpdate(
  socket: Socket,
  device: AftershockDevice,
  update: AftershockPackage,
  report: (status: SyncStatus) => SyncStatus
): Promise<SyncStatus> {
  let sent = 0
  let reported = 0
  const push = (): void => {
    reported = sent
    report({
      phase: 'sending',
      message: `Aftershock ${update.version}`,
      sent,
      total: update.size,
      deviceName: device.name
    })
  }
  push()
  await writeJson(socket, { v: 1, type: 'update', version: update.version, build: update.build, size: update.size })
  await sendFileWithProgress(socket, update.filePath, (count) => {
    sent += count
    if (sent - reported >= 256 * 1024 || sent >= update.size) push()
  })
  const result = await readJson(socket)
  if (result.type === 'error') {
    return report({
      phase: 'error',
      message: typeof result.message === 'string' ? result.message : 'Aftershock could not install the update',
      sent,
      total: update.size,
      deviceName: device.name
    })
  }
  if (result.type !== 'installed') throw new Error('Aftershock did not install the update')
  return report({
    phase: 'done',
    message: `Aftershock is installing ${update.version}. Open it again and sync once that finishes.`,
    sent: update.size,
    total: update.size,
    deviceName: device.name
  })
}

function doneMessage(name: string, pending: OutgoingFile[]): string {
  const songs = pending.filter((file) => file.kind === 'audio').length
  const covers = pending.length - songs
  if (songs === 0 && covers === 0) return `Updated ${name}. Everything was already there`
  if (songs === 0) return `Sent updated artwork to ${name}`
  const songLabel = songs === 1 ? '1 song' : `${songs} songs`
  return covers > 0 ? `Sent ${songLabel} and artwork to ${name}` : `Sent ${songLabel} to ${name}`
}

function libraryFiles(layout: RepositoryLayout): OutgoingFile[] {
  const files: OutgoingFile[] = []
  for (const track of loadLibrary(layout)) {
    const path = resolveTrackPath(layout, track)
    if (!existsSync(path)) continue
    files.push({
      kind: 'audio',
      name: track.relPath.replaceAll('\\', '/'),
      path,
      size: statSync(path).size
    })
  }
  if (existsSync(layout.covers)) {
    for (const name of readdirSync(layout.covers)) {
      const path = join(layout.covers, name)
      if (!statSync(path).isFile()) continue
      files.push({ kind: 'cover', name, path, size: statSync(path).size })
    }
  }
  return files
}

export async function syncToAftershock(
  layout: RepositoryLayout,
  device: AftershockDevice,
  onStatus: (status: SyncStatus) => void
): Promise<SyncStatus> {
  const tracks = loadLibrary(layout)
  const files = libraryFiles(layout)
  const total = files.reduce((sum, file) => sum + file.size, 0)
  const report = (status: SyncStatus): SyncStatus => {
    onStatus(status)
    return status
  }

    const socket = await openSocket(device)
    const extras: Socket[] = []
    try {
    socket.setTimeout(60000)
    const update = newerAftershock(device.build, bundledAftershock())
    report({
      phase: 'waiting',
      message: update
        ? `Waiting for ${device.name} to install Aftershock ${update.version}`
        : `Waiting for ${device.name} to accept`,
      sent: 0,
      total: 0,
      deviceName: device.name
    })
    await writeJson(socket, {
      v: 1,
      type: 'offer',
      name: hostname() || 'Shockwave',
      tracks: tracks.length,
      bytes: update ? update.size : total,
      ...(update ? { update: { version: update.version, build: update.build, bytes: update.size } } : {})
    })
    const reply = await readJson(socket)
    socket.setTimeout(0)
    if (reply.type === 'decline') {
      socket.end()
      return report({
        phase: 'declined',
        message: update
          ? `${device.name} needs Aftershock ${update.version} before it can sync`
          : `${device.name} declined the sync`,
        sent: 0,
        total: 0,
        deviceName: device.name
      })
    }
    if (reply.type !== 'accept') throw new Error('Aftershock did not accept the sync')
    if (update && reply.update !== true) {
      socket.end()
      return report({
        phase: 'error',
        message: `${device.name} needs Aftershock ${update.version} before it can sync`,
        sent: 0,
        total: 0,
        deviceName: device.name
      })
    }
    if (reply.update === true) {
      if (!update) throw new Error('Aftershock asked for an update that is not available')
      const installed = await sendAftershockUpdate(socket, device, update, report)
      socket.end()
      return installed
    }

    const pending = filesToSend(files, heldFiles(reply))
    const shrinking = pending.some((file) => COMPRESSIBLE.has(extname(file.name).toLowerCase()))
    if (shrinking) {
      report({
        phase: 'sending',
        message: 'Compressing the library',
        sent: 0,
        total: 0,
        deviceName: device.name
      })
    }
    const packed: PackedFile[] = []
    let wire = 0
    try {
      for (const file of pending) packed.push(await packFile(file))
      wire = packed.reduce((sum, file) => sum + frameHeader(file).length + file.storedSize, 0)
      await writeJson(socket, {
        v: 1,
        type: 'manifest',
        tracks,
        playlists: loadPlaylists(layout),
        settings: loadSettings(layout),
        lyrics: loadLyricsCache(layout, new Set(tracks.map((track) => track.id))),
        files: files.map((file) => ({ kind: file.kind, name: file.name, size: file.size })),
        bytes: wire,
        archive: true
      })
      const groups = splitLanes(packed, 4)
      const token = randomUUID()
      const sizes = groups.map((group) => group.reduce((sum, file) => sum + frameHeader(file).length + file.storedSize, 0))
      await writeJson(socket, { v: 1, type: 'lanes', token, sizes })
      let sent = 0
      let reported = 0
      const label = sendingLabel(pending)
      const push = (count: number): void => {
        sent += count
        if (sent - reported < 1024 * 1024 && sent < wire) return
        reported = sent
        report({
          phase: 'sending',
          message: label,
          sent,
          total: wire,
          deviceName: device.name
        })
      }
      await Promise.all(
        groups.map(async (group, index) => {
          const lane = index === 0 ? socket : await openSocket(device)
          if (index !== 0) extras.push(lane)
          if (index !== 0) await writeJson(lane, { v: 1, type: 'lane', token, index })
          for (const file of group) {
            const header = frameHeader(file)
            await writeBuffer(lane, header)
            push(header.length)
            await sendFileWithProgress(lane, file.path, push)
          }
          if (index !== 0) lane.end()
        })
      )
      if (sent < wire) push(wire - sent)
      await writeJson(socket, { v: 1, type: 'done' })
    } finally {
      releasePacked(packed)
    }
    socket.end()
    return report({
      phase: 'done',
      message: doneMessage(device.name, pending),
      sent: wire,
      total: wire,
      deviceName: device.name
    })
  } catch (error) {
    for (const extra of extras) extra.destroy()
    socket.destroy()
    return report({
      phase: 'error',
      message: error instanceof Error ? error.message : 'Sync failed',
      sent: 0,
      total,
      deviceName: device.name
    })
  }
}

export async function syncLibrary(
  layout: RepositoryLayout,
  onStatus: (status: SyncStatus) => void
): Promise<SyncStatus> {
  onStatus({ phase: 'scanning', message: 'Looking for Aftershock', sent: 0, total: 0 })
  const devices = await discoverAftershock()
  if (devices.length === 0) {
    const status: SyncStatus = {
      phase: 'error',
      message: 'No Aftershock found on this network. Open Aftershock on the same Wi-Fi.',
      sent: 0,
      total: 0
    }
    onStatus(status)
    return status
  }
  return syncToAftershock(layout, devices[0], onStatus)
}
