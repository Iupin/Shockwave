import { Client } from 'discord-rpc'
import type { PresencePayload } from '../shared/types'
import { readUserConfig, writeUserConfig } from './config'

const CLIENT_ID = '1567315925705822358'
const LISTENING = 2

type RpcClient = Client & {
  request(cmd: string, args?: object): Promise<unknown>
}

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

function activityFrom(payload: PresencePayload | null): Record<string, unknown> {
  const details = payload?.title
    ? clip(payload.playing ? payload.title : `${payload.title} (paused)`)
    : 'Browsing library'
  const state = payload?.title ? clip(payload.artist || 'Unknown artist') : 'Shockwave'
  const activity: Record<string, unknown> = {
    type: LISTENING,
    details,
    state,
    assets: {
      large_image: 'logo',
      large_text: clip(payload?.album || 'Shockwave')
    },
    instance: false
  }

  if (payload?.title && payload.playing && payload.duration > 0) {
    const elapsedMs = Math.max(0, Math.min(payload.elapsed, payload.duration)) * 1000
    const start = Date.now() - elapsedMs
    activity.timestamps = {
      start,
      end: start + payload.duration * 1000
    }
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
    await (rpc as RpcClient).request('SET_ACTIVITY', {
      pid: process.pid,
      activity: activityFrom(payload)
    })
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
