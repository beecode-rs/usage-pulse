import type { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'

export type ProviderCatalogEntry = {
  defaultRefreshIntervalMs: number
  description: string
  id: ProviderIdMapper
  name: string
}
