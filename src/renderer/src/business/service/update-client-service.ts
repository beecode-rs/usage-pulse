import type {
  UpdateDownloadProgressListener,
  UpdateDownloadResult,
  UpdateStatus,
  UpdateStatusListener,
} from '#src/shared/business/model/update-model'

export const updateClientService = {
  checkForUpdate: (): Promise<UpdateStatus> => {
    return window.usageApi.checkForUpdate()
  },
  downloadUpdate: (): Promise<UpdateDownloadResult> => {
    return window.usageApi.downloadUpdate()
  },
  getStatus: (): Promise<UpdateStatus> => {
    return window.usageApi.getUpdateStatus()
  },
  openRelease: (): void => {
    window.usageApi.openRelease()
  },
  restartUpdate: (): Promise<void> => {
    return window.usageApi.restartUpdate()
  },
  subscribeToUpdateDownloadProgress: (params: { onUpdate: UpdateDownloadProgressListener }): (() => void) => {
    const { onUpdate } = params

    return window.usageApi.onUpdateDownloadStatus({ onUpdate })
  },
  subscribeToUpdateStatus: (params: { onUpdate: UpdateStatusListener }): (() => void) => {
    const { onUpdate } = params

    return window.usageApi.onUpdateStatus({ onUpdate })
  },
}
