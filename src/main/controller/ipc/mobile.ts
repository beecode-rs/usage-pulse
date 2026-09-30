import { mobileServerServiceSingleton } from '#src/main/business/service/mobile-server-service-singleton'
import { type MobileConnectedDevice } from '#src/shared/business/model/mobile-api-model'

export const ipcMobile = {
  getConnectedDevices: (): MobileConnectedDevice[] => {
    return mobileServerServiceSingleton().getConnectedDevices()
  },
}
