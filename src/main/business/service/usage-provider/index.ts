import type { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import type { UsageWindow } from '#src/shared/business/model/usage-model'

export interface UsageProvider {
  fetchUsage: (params: { accessToken: string }) => Promise<UsageWindow[]>
  getProviderId: () => ProviderIdMapper
}
