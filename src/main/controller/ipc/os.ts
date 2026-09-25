import { osUtil } from '#src/main/util/os-util'
import { type OS } from '#src/shared/business/enum/os-enum'

export const ipcOs = {
  getPlatform: (): OS => {
    return osUtil.resolvePlatform()
  },
}
