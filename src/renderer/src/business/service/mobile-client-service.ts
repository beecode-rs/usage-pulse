import type { MobileConnectedDevice, MobileDevicesUpdateListener } from '#src/shared/business/model/mobile-api-model'

export const mobileClientService = {
  getConnectedDevices: (): Promise<MobileConnectedDevice[]> => {
    return window.usageApi.getMobileDevices()
  },

  subscribeToDeviceUpdates: (params: { onUpdate: MobileDevicesUpdateListener }): (() => void) => {
    const { onUpdate } = params

    return window.usageApi.onMobileDevicesUpdate(onUpdate)
  },
}
