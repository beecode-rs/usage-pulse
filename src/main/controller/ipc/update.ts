import { shell } from 'electron'

import { updateServiceSingleton } from '#src/main/business/service/update-service-singleton'
import { type UpdateStatus } from '#src/shared/business/model/update-model'

export const ipcUpdate = {
  getStatus: (): UpdateStatus => {
    return updateServiceSingleton().getStatus()
  },

  openRelease: (): void => {
    const releaseUrl = updateServiceSingleton().getStatus().releaseUrl

    if (!releaseUrl?.startsWith('https://github.com/')) {
      return
    }

    void shell.openExternal(releaseUrl)
  },
}
