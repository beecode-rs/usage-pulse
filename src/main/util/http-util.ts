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
        throw new Error(`request failed with status ${String(response.status)} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      throw new Error(`request to ${url} failed: ${errorUtil.resolveMessage(error)}`)
    } finally {
      clearTimeout(timeoutId)
    }
  },
}
