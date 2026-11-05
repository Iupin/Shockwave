import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import type { AftershockCommandResult, AftershockEndpoint, AftershockPairRequest } from '../shared/types'
import { bundledAftershock } from './aftershock-package'

const PACKAGE_ID = 'com.iupin.aftershock'

interface CommandOutput {
  code: number
  text: string
}

function adbPath(): string | null {
  const candidates: string[] = []
  if (typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0) {
    candidates.push(join(process.resourcesPath, 'platform-tools', 'adb.exe'))
  }
  candidates.push(join(process.cwd(), 'resources', 'platform-tools', 'adb.exe'))
  if (process.env.LOCALAPPDATA) {
    candidates.push(join(process.env.LOCALAPPDATA, 'Android', 'sdk', 'platform-tools', 'adb.exe'))
  }
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function runAdb(args: string[], timeoutMs: number): Promise<CommandOutput> {
  const adb = adbPath()
  if (!adb) {
    return Promise.reject(new Error('Wireless debugging tools are missing from this Shockwave install.'))
  }
  return new Promise((resolve, reject) => {
    const child = spawn(adb, args, { windowsHide: true })
    let text = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(
        new Error(
          'The phone did not answer in time. Keep Wireless debugging open, and keep the phone and this PC on the same Wi-Fi.'
        )
      )
    }, timeoutMs)
    const append = (chunk: Buffer): void => {
      text += chunk.toString()
    }
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, text: text.trim() })
    })
  })
}

function endpoint(input: AftershockEndpoint): string {
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(input.address) || input.address.split('.').some((part) => Number(part) > 255)) {
    throw new Error('Enter the IP address shown on the phone.')
  }
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
    throw new Error('Enter the port shown on the phone.')
  }
  return `${input.address}:${input.port}`
}

function result(ok: boolean, message: string): AftershockCommandResult {
  return { ok, message }
}

export async function pairAftershock(input: AftershockPairRequest): Promise<AftershockCommandResult> {
  try {
    const target = endpoint(input)
    if (!/^\d{6}$/.test(input.code)) {
      return result(false, 'Enter the six-digit pairing code from the phone.')
    }
    await runAdb(['start-server'], 15000)
    const paired = await runAdb(['pair', target, input.code], 30000)
    if (paired.code === 0 && /successfully paired/i.test(paired.text)) {
      return result(true, 'Paired with the phone.')
    }
    return result(false, paired.text || 'Pairing failed. Check the code, IP address, and pairing port, then try again.')
  } catch (error) {
    return result(false, error instanceof Error ? error.message : String(error))
  }
}

export async function connectAftershock(input: AftershockEndpoint): Promise<AftershockCommandResult> {
  try {
    const target = endpoint(input)
    await runAdb(['start-server'], 15000)
    const connected = await runAdb(['connect', target], 20000)
    if (connected.code === 0 && /connected to/i.test(connected.text)) {
      return result(true, `Connected to ${target}.`)
    }
    return result(
      false,
      connected.text || 'Could not connect. Use the IP address and port at the top of Wireless debugging.'
    )
  } catch (error) {
    return result(false, error instanceof Error ? error.message : String(error))
  }
}

export async function installAftershock(input: AftershockEndpoint): Promise<AftershockCommandResult> {
  try {
    const target = endpoint(input)
    const packaged = bundledAftershock()
    if (!packaged) {
      return result(false, 'This Shockwave install does not include Aftershock.')
    }
    await runAdb(['start-server'], 15000)
    const connected = await runAdb(['connect', target], 20000)
    if (connected.code !== 0 || !/connected to/i.test(connected.text)) {
      return result(false, connected.text || 'The Wi-Fi connection dropped. Connect again from the previous step.')
    }
    const installed = await runAdb(['-s', target, 'install', '-r', packaged.filePath], 180000)
    if (installed.code !== 0 || !/success/i.test(installed.text)) {
      return result(false, installed.text || 'Aftershock did not install.')
    }
    const listed = await runAdb(['-s', target, 'shell', 'pm', 'path', PACKAGE_ID], 20000)
    if (listed.code !== 0 || !/package:/i.test(listed.text)) {
      return result(false, 'The install finished, but Aftershock is not on the phone.')
    }
    return result(true, `Aftershock ${packaged.version} is installed on the phone.`)
  } catch (error) {
    return result(false, error instanceof Error ? error.message : String(error))
  }
}
