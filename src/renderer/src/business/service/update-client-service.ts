import type { UpdateStatus, UpdateStatusListener } from '#src/shared/business/model/update-model'

export const updateClientService = {
  checkForUpdate: (): Promise<UpdateStatus> => {
    return window.usageApi.checkForUpdate()
  },
  downloadUpdateAndOpenInstaller: (): Promise<string> => {
    return window.usageApi.downloadUpdateAndOpenInstaller()
  },
  getStatus: (): Promise<UpdateStatus> => {
    return window.usageApi.getUpdateStatus()
  },
  openRelease: (): void => {
    window.usageApi.openRelease()
  },
  subscribeToUpdateStatus: (params: { onUpdate: UpdateStatusListener }): (() => void) => {
    const { onUpdate } = params

    return window.usageApi.onUpdateStatus({ onUpdate })
  },
}
