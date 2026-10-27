import { updateServiceSingleton } from '#src/main/business/service/update-service-singleton'
import { type UpdateDownloadResult, type UpdateStatus } from '#src/shared/business/model/update-model'

export const ipcUpdate = {
  check: async (): Promise<UpdateStatus> => {
    return await updateServiceSingleton().checkForUpdate()
  },

  download: async (): Promise<UpdateDownloadResult> => {
    return await updateServiceSingleton().downloadUpdate()
  },

  getStatus: (): UpdateStatus => {
    return updateServiceSingleton().getStatus()
  },

  openRelease: (): void => {
    updateServiceSingleton().openRelease()
  },

  restart: (): void => {
    updateServiceSingleton().relaunchForUpdate()
  },
}
