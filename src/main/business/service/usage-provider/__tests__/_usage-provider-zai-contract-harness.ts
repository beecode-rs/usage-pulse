import { vi } from 'vitest'

import { UsageProviderZai } from '#src/main/business/service/usage-provider/zai'
import { type UsageWindow } from '#src/shared/business/model/usage-model'
import { errorUtil } from '#src/shared/util/error-util'

const httpUtilFetchJsonResponse = vi.hoisted((): { response: unknown } => {
  return { response: undefined }
})

vi.mock('#src/main/util/http-util', () => {
  return {
    httpUtil: {
      fetchJson: (): Promise<unknown> => Promise.resolve(httpUtilFetchJsonResponse.response),
    },
  }
})

type FetchUsageOutcome = { errorMessage: string } | { windows: UsageWindow[] }

export const usageProviderZaiContractHarness = {
  fetchUsage: async (params: { accessToken: string; response: unknown }): Promise<FetchUsageOutcome> => {
    const { accessToken, response } = params
    httpUtilFetchJsonResponse.response = response

    try {
      return { windows: await new UsageProviderZai().fetchUsage({ accessToken }) }
    } catch (error) {
      return { errorMessage: errorUtil.resolveMessage(error) }
    }
  },
}
