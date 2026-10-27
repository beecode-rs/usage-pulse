import { typeUtil } from '@beecode/msh-util'
import { type ReactElement, useEffect, useState } from 'react'

import { updateClientService } from '#src/renderer/src/business/service/update-client-service'
import '#src/renderer/src/ui-component/app-shell/app-footer.css'
import { constant } from '#src/renderer/src/util/constant'
import type {
  UpdateDownloadProgress,
  UpdateDownloadStatus,
  UpdateStatus,
} from '#src/shared/business/model/update-model'
import { errorUtil } from '#src/shared/util/error-util'

type UpdateDownloadState = 'downloaded' | 'downloading' | 'idle' | 'installing' | 'restart-required'

type UpdateDownload = {
  errorMessage: string
  filePath: string
  percent?: number
  state: UpdateDownloadState
}

const resolveDownloadState = (params: { status: UpdateDownloadStatus }): UpdateDownloadState => {
  const { status } = params

  switch (status) {
    case 'completed': {
      return 'downloaded'
    }

    case 'downloading': {
      return 'downloading'
    }

    case 'installing': {
      return 'installing'
    }

    case 'restart-required': {
      return 'restart-required'
    }

    case 'error': {
      return 'idle'
    }

    case 'idle': {
      return 'idle'
    }

    default: {
      throw typeUtil.exhaustiveError('unsupported update download status [status]', status)
    }
  }
}

const resolveDownloadPercent = (params: { progress: UpdateDownloadProgress }): number | undefined => {
  const { progress } = params

  if (progress.totalBytes <= 0) {
    return undefined
  }

  return Math.floor((progress.receivedBytes / progress.totalBytes) * 100)
}

const resolveUpdateButtonClassName = (params: { state: UpdateDownloadState }): string => {
  const { state } = params

  if (state === 'restart-required') {
    return 'app-footer-update-button app-footer-update-button--restart'
  }

  return 'app-footer-update-button'
}

const resolveUpdateButtonLabel = (params: {
  download: UpdateDownload
  hasDownloadableAsset: boolean
  latestVersion: string
}): string => {
  const { download, hasDownloadableAsset, latestVersion } = params

  switch (download.state) {
    case 'downloading': {
      if (download.percent === undefined) {
        return 'Downloading…'
      }

      return `Downloading… ${String(download.percent)}%`
    }

    case 'installing': {
      return 'Installing…'
    }

    case 'restart-required': {
      return 'Restart to finish update'
    }

    case 'downloaded': {
      return 'Opened installer'
    }

    case 'idle': {
      if (hasDownloadableAsset) {
        return `Download v${latestVersion}`
      }

      return `Update available · v${latestVersion}`
    }

    default: {
      throw typeUtil.exhaustiveError('unsupported update download state [state]', download.state)
    }
  }
}

const resolveUpdateButtonTitle = (params: {
  currentVersion: string
  download: UpdateDownload
  hasDownloadableAsset: boolean
  latestVersion: string
}): string => {
  const { currentVersion, download, hasDownloadableAsset, latestVersion } = params

  if (download.errorMessage !== '') {
    return download.errorMessage
  }

  switch (download.state) {
    case 'downloading': {
      return 'Downloading the update'
    }

    case 'installing': {
      return 'Installing the downloaded update…'
    }

    case 'restart-required': {
      return 'Update installed — restart to finish'
    }

    case 'downloaded': {
      return `Installer saved to ${download.filePath}`
    }

    case 'idle': {
      if (hasDownloadableAsset) {
        return `Version ${latestVersion} available (current ${currentVersion})`
      }

      return 'Open the GitHub release page'
    }

    default: {
      throw typeUtil.exhaustiveError('unsupported update download state [state]', download.state)
    }
  }
}

export const AppShellFooter = (): ReactElement => {
  const [download, setDownload] = useState<UpdateDownload>(constant.appFooter.idleDownload)
  const [status, setStatus] = useState<UpdateStatus | undefined>(undefined)

  useEffect(() => {
    const loadStatus = async (): Promise<void> => {
      try {
        setStatus(await updateClientService.getStatus())
      } catch {
        return
      }
    }

    void loadStatus()

    return updateClientService.subscribeToUpdateStatus({
      onUpdate: (nextStatus) => {
        setStatus(nextStatus)
      },
    })
  }, [])

  useEffect(() => {
    return updateClientService.subscribeToUpdateDownloadProgress({
      onUpdate: (progress) => {
        const state = resolveDownloadState({ status: progress.status })

        if (state === 'idle') {
          return
        }

        setDownload((current) => {
          return {
            errorMessage: current.errorMessage,
            filePath: progress.filePath ?? current.filePath,
            percent: resolveDownloadPercent({ progress }),
            state,
          }
        })
      },
    })
  }, [])

  if (status === undefined) {
    return <footer className="app-footer" />
  }

  const hasDownloadableAsset = status.asset !== undefined
  const latestVersion = status.latestVersion

  const handleUpdateClick = (): void => {
    if (download.state === 'restart-required') {
      void updateClientService.restartUpdate().catch(() => {
        return undefined
      })

      return
    }

    if (status.asset === undefined) {
      updateClientService.openRelease()

      return
    }

    setDownload({ errorMessage: '', filePath: '', state: 'downloading' })

    void updateClientService
      .downloadUpdate()
      .then((result) => {
        setDownload({
          errorMessage: '',
          filePath: result.filePath,
          state: resolveDownloadState({ status: result.status }),
        })
      })
      .catch((error: unknown) => {
        setDownload({ ...constant.appFooter.idleDownload, errorMessage: errorUtil.resolveMessage(error) })
      })
  }

  return (
    <footer className="app-footer">
      {status.isUpdateAvailable && latestVersion !== undefined && (
        <button
          className={resolveUpdateButtonClassName({ state: download.state })}
          disabled={download.state === 'downloading' || download.state === 'installing'}
          onClick={handleUpdateClick}
          title={resolveUpdateButtonTitle({
            currentVersion: status.currentVersion,
            download,
            hasDownloadableAsset,
            latestVersion,
          })}
          type="button"
        >
          {resolveUpdateButtonLabel({ download, hasDownloadableAsset, latestVersion })}
        </button>
      )}
      <span className="app-footer-version">v{status.currentVersion}</span>
    </footer>
  )
}
