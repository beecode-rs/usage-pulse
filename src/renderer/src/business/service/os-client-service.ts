import type { OS } from '#src/shared/business/enum/os-enum'

export const osClientService = {
  getPlatform: (): Promise<OS> => {
    return window.usageApi.getPlatform()
  },
}
