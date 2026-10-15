import type { NaxloApi } from '../shared/api'

declare global {
  interface Window {
    /** Bridge exposed by `src/preload/index.ts`. */
    naxlo: NaxloApi
  }
}

export {}
