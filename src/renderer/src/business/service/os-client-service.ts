import type { OS } from '#src/shared/os-model'

export const osClientService = {
  getPlatform: (): Promise<OS> => {
    return window.usageApi.getPlatform()
  },
}
