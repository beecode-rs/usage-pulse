/// <reference types="vite/client" />

import type { UsageApiClient } from '#src/shared/business/model/usage-model'

declare global {
  interface Window {
    usageApi: UsageApiClient
  }
}

export {}
