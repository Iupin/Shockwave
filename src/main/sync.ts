import { createReadStream, existsSync, readdirSync, statSync } from 'fs'
import { createSocket, RemoteInfo } from 'dgram'
import { Socket, connect } from 'net'
import { networkInterfaces } from 'os'
import { join } from 'path'
import { hostname } from 'os'
import { SyncStatus } from '../shared/types'
import { loadLibrary, resolveTrackPath } from './library'
import { loadPlaylists } from './playlists'
import { RepositoryLayout, loadSettings } from './repository'

const UDP_PORT = 47820

export interface AftershockDevice {
  id: string
  name: string
  address: string
  port: number
}

interface OutgoingFile {
  kind: 'audio' | 'cover'
  name: string
  path: string
  size: number
}

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

export function discoverAftershock(timeoutMs = 2500): Promise<AftershockDevice[]> {
  return new Promise((resolve) => {
    const found = new Map<string, AftershockDevice>()
    const socket = createSocket({ type: 'udp4', reuseAddr: true })
    let closed = false
    const finish = (): void => {
      if (closed) return
      closed = true
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
        }
        if (data.v !== 1 || data.type !== 'hello') return
        const id = data.id || rinfo.address
        found.set(id, {
          id,
          name: data.name || 'Aftershock',
          address: rinfo.address,
          port: data.port && data.port > 0 ? data.port : 47821
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
      const timer = setInterval(send, 400)
      setTimeout(() => {
        clearInterval(timer)
        finish()
      }, timeoutMs)
    })
  })
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

async function readJson(socket: Socket): Promise<{ type?: string }> {
  const length = (await readExact(socket, 4)).readUInt32BE(0)
  if (length <= 0 || length > 1024 * 1024) throw new Error('Unexpected reply from Aftershock')
  return JSON.parse((await readExact(socket, length)).toString('utf8')) as { type?: string }
}

function sendFile(socket: Socket, file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(file)
    let settled = false
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      socket.off('error', fail)
      if (error) {
        stream.destroy()
        reject(error)
        return
      }
      resolve()
    }
    const fail = (error: Error): void => finish(error)
    stream.on('error', fail)
    socket.on('error', fail)
    stream.on('end', () => finish())
    stream.pipe(socket, { end: false })
  })
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

  const socket = connect({ host: device.address, port: device.port })
  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (error: Error): void => reject(error)
      socket.once('error', fail)
      socket.once('connect', () => {
        socket.off('error', fail)
        resolve()
      })
    })
    socket.setTimeout(60000)
    report({
      phase: 'waiting',
      message: `Waiting for ${device.name} to accept`,
      sent: 0,
      total,
      deviceName: device.name
    })
    await writeJson(socket, {
      v: 1,
      type: 'offer',
      name: hostname() || 'Shockwave',
      tracks: tracks.length,
      bytes: total
    })
    const reply = await readJson(socket)
    socket.setTimeout(0)
    if (reply.type === 'decline') {
      socket.end()
      return report({
        phase: 'declined',
        message: `${device.name} declined the sync`,
        sent: 0,
        total,
        deviceName: device.name
      })
    }
    if (reply.type !== 'accept') throw new Error('Aftershock did not accept the sync')

    await writeJson(socket, {
      v: 1,
      type: 'manifest',
      tracks,
      playlists: loadPlaylists(layout),
      settings: loadSettings(layout)
    })
    let sent = 0
    for (const file of files) {
      await writeJson(socket, { v: 1, type: 'file', kind: file.kind, name: file.name, size: file.size })
      await sendFile(socket, file.path)
      sent += file.size
      report({
        phase: 'sending',
        message: file.name,
        sent,
        total,
        deviceName: device.name
      })
    }
    await writeJson(socket, { v: 1, type: 'done' })
    socket.end()
    return report({
      phase: 'done',
      message: `Sent ${tracks.length} songs to ${device.name}`,
      sent: total,
      total,
      deviceName: device.name
    })
  } catch (error) {
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
