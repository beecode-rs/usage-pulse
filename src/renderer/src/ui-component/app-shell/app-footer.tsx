import { type ReactElement, useEffect, useState } from 'react'

import { updateClientService } from '#src/renderer/src/business/service/update-client-service'
import '#src/renderer/src/ui-component/app-shell/app-footer.css'
import type { UpdateStatus } from '#src/shared/business/model/update-model'

export const AppFooter = (): ReactElement => {
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

  const latestVersion = status.latestVersion

  return (
    <footer className="app-footer">
      {status.isUpdateAvailable && latestVersion !== undefined && (
        <button
          className="app-footer-update-button"
          onClick={() => {
            updateClientService.openRelease()
          }}
          type="button"
        >
          Update available · v{latestVersion}
        </button>
      )}
      <span className="app-footer-version">v{status.currentVersion}</span>
    </footer>
  )
}
