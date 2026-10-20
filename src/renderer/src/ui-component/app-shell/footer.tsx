import { typeUtil } from '@beecode/msh-util'
import { type ReactElement, useEffect, useState } from 'react'

import { updateClientService } from '#src/renderer/src/business/service/update-client-service'
import '#src/renderer/src/ui-component/app-shell/app-footer.css'
import { constant } from '#src/renderer/src/util/constant'
import type { UpdateStatus } from '#src/shared/business/model/update-model'
import { errorUtil } from '#src/shared/util/error-util'

type UpdateDownloadState = 'downloaded' | 'downloading' | 'idle'

type UpdateDownload = {
  errorMessage: string
  filePath: string
  state: UpdateDownloadState
}

const resolveUpdateButtonLabel = (params: {
  download: UpdateDownload
  hasDownloadableAsset: boolean
  latestVersion: string
}): string => {
  const { download, hasDownloadableAsset, latestVersion } = params

  switch (download.state) {
    case 'downloading': {
      return 'Downloading…'
    }

    case 'downloaded': {
      return 'Installer opened'
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

  if (status === undefined) {
    return <footer className="app-footer" />
  }

  const hasDownloadableAsset = status.asset !== undefined
  const latestVersion = status.latestVersion

  const handleUpdateClick = (): void => {
    if (status.asset === undefined) {
      updateClientService.openRelease()

      return
    }

    setDownload({ errorMessage: '', filePath: '', state: 'downloading' })

    void updateClientService
      .downloadUpdateAndOpenInstaller()
      .then((filePath) => {
        setDownload({ errorMessage: '', filePath, state: 'downloaded' })
      })
      .catch((error: unknown) => {
        setDownload({ ...constant.appFooter.idleDownload, errorMessage: errorUtil.resolveMessage(error) })
      })
  }

  return (
    <footer className="app-footer">
      {status.isUpdateAvailable && latestVersion !== undefined && (
        <button
          className="app-footer-update-button"
          disabled={download.state !== 'idle'}
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
