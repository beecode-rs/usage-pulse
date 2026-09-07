import type { UpdateStatus, UpdateStatusListener } from '#src/shared/business/model/update-model'

export const updateClientService = {
  getStatus: (): Promise<UpdateStatus> => {
    return window.usageApi.getUpdateStatus()
  },
  openRelease: (): void => {
    window.usageApi.openRelease()
  },
  subscribeToUpdateStatus: (params: { onUpdate: UpdateStatusListener }): (() => void) => {
    const { onUpdate } = params

    return window.usageApi.onUpdateStatus(onUpdate)
  },
}
