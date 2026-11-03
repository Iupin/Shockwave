import { Client, type Presence } from 'discord-rpc'
import type { PresencePayload } from '../shared/types'
import { readUserConfig, writeUserConfig } from './config'

const CLIENT_ID = '1567315925705822358'

let client: Client | null = null
let connecting: Promise<void> | null = null
let lastPayload: PresencePayload | null = null

function clip(value: string, max = 128): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function enabled(): boolean {
  return readUserConfig().discordRichPresence !== false
}

async function ensureClient(): Promise<Client | null> {
  if (!enabled()) return null
  if (client) return client
  if (connecting) {
    await connecting
    return client
  }
  const next = new Client({ transport: 'ipc' })
  connecting = next
    .login({ clientId: CLIENT_ID })
    .then(() => {
      client = next
    })
    .catch(() => {
      client = null
    })
    .finally(() => {
      connecting = null
    })
  next.on('disconnected', () => {
    client = null
  })
  await connecting
  return client
}

function activityFrom(payload: PresencePayload | null): Presence & { type: number } {
  if (!payload?.title) {
    return {
      details: 'Browsing library',
      state: 'Shockwave',
      largeImageKey: 'logo',
      largeImageText: 'Shockwave',
      instance: false,
      type: 2
    }
  }

  const activity: Presence & { type: number } = {
    details: clip(payload.playing ? payload.title : `${payload.title} (paused)`),
    state: clip(payload.artist || 'Unknown artist'),
    largeImageKey: 'logo',
    largeImageText: clip(payload.album || 'Shockwave'),
    instance: false,
    type: 2
  }

  if (payload.playing && payload.duration > 0) {
    const elapsedMs = Math.max(0, Math.min(payload.elapsed, payload.duration)) * 1000
    const start = Date.now() - elapsedMs
    activity.startTimestamp = new Date(start)
    activity.endTimestamp = new Date(start + payload.duration * 1000)
  }

  return activity
}

export async function startDiscord(): Promise<void> {
  if (!enabled()) return
  await ensureClient()
  await setPresence(lastPayload)
}

export async function setDiscordEnabled(value: boolean): Promise<void> {
  writeUserConfig({ discordRichPresence: value })
  if (!value) {
    await clearPresence()
    if (client) {
      try {
        client.destroy()
      } catch {
        /* ignore */
      }
      client = null
    }
    return
  }
  await startDiscord()
}

export async function setPresence(payload: PresencePayload | null): Promise<void> {
  lastPayload = payload
  if (!enabled()) return
  const rpc = await ensureClient()
  if (!rpc) return
  try {
    await rpc.setActivity(activityFrom(payload))
  } catch {
    client = null
  }
}

export async function clearPresence(): Promise<void> {
  if (!client) return
  try {
    await client.clearActivity()
  } catch {
    /* Discord may not be running */
  }
}

export function stopDiscord(): void {
  if (!client) return
  try {
    void client.clearActivity()
    client.destroy()
  } catch {
    /* ignore */
  }
  client = null
}
