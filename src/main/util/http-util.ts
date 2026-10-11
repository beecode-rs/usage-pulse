import { config } from '#src/main/util/config'
import { errorUtil } from '#src/main/util/error-util'

export const httpUtil = {
  fetchJson: async (params: {
    headers?: Record<string, string>
    timeoutMs?: number
    url: string
  }): Promise<unknown> => {
    const { headers = {}, timeoutMs = config.httpTimeoutMs, url } = params
    const abortController = new AbortController()

    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, timeoutMs)

    try {
      const response = await fetch(url, { headers, signal: abortController.signal })

      if (!response.ok) {
        throw Object.assign(new Error(`request failed with status ${String(response.status)} ${response.statusText}`), {
          status: response.status,
        })
      }

      return await response.json()
    } catch (error) {
      throw Object.assign(new Error(`request to ${url} failed: ${errorUtil.resolveMessage(error)}`), {
        status: (error as { status?: unknown }).status,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  },

  resolveErrorStatus: (error: unknown): number | undefined => {
    const status = (error as { status?: unknown } | undefined)?.status

    if (typeof status === 'number') {
      return status
    }

    return undefined
  },
}
