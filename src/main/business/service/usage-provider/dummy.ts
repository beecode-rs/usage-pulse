import { type UsageProvider } from '#src/main/business/service/usage-provider/usage-provider'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { type UsageWindow } from '#src/shared/business/model/usage-model'

export class UsageProviderDummy implements UsageProvider {
  getProviderId(): ProviderIdMapper {
    return ProviderIdMapper.DUMMY
  }

  fetchUsage(_params: { accessToken: string }): Promise<UsageWindow[]> {
    return Promise.resolve([])
  }
}
