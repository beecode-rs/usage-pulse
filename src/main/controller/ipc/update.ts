import { updateServiceSingleton } from '#src/main/business/service/update-service-singleton'
import { type UpdateStatus } from '#src/shared/business/model/update-model'

export const ipcUpdate = {
  check: async (): Promise<UpdateStatus> => {
    return await updateServiceSingleton().checkForUpdate()
  },

  download: async (): Promise<string> => {
    return await updateServiceSingleton().downloadUpdateAndOpenInstaller()
  },

  getStatus: (): UpdateStatus => {
    return updateServiceSingleton().getStatus()
  },

  openRelease: (): void => {
    updateServiceSingleton().openRelease()
  },
}
