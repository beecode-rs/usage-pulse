/// <reference types="vite/client" />

import type { UsageApiClient } from '#src/renderer/src/business/service/usage-api-client'

declare global {
  interface Window {
    usageApi: UsageApiClient
  }
}

export {}
