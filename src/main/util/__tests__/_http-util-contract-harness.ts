import { vi } from 'vitest'

import { httpUtil } from '#src/main/util/http-util'

export const httpUtilContractHarness = {
  async fetchJsonErrorStatus(params: { status: number }): Promise<number> {
    const { status } = params
    const fetchMock = vi.fn(() => {
      return Promise.resolve(new Response('{"ok":false}', { status, statusText: 'Unauthorized' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      const error = await httpUtil.fetchJson({ url: 'https://example.test/usage' }).then(
        () => {
          return undefined
        },
        (rejection: unknown) => {
          return rejection
        },
      )

      return httpUtil.resolveErrorStatus(error) ?? -1
    } finally {
      vi.unstubAllGlobals()
    }
  },
}
