import type { ShockwaveApi } from './index'

declare global {
  interface Window {
    shockwave: ShockwaveApi
  }

  interface File {
    path?: string
  }
}

export {}
