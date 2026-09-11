import { type ReactElement, useEffect, useState } from 'react'

import { sessionsClientService } from '#src/renderer/src/business/service/sessions-client-service'
import { errorUtil } from '#src/renderer/src/util/error-util'
import { SessionFocusSupportStatusMapper } from '#src/shared/business/enum/session-focus-support-status-mapper-enum'
import { type SessionFocusSupport } from '#src/shared/business/model/session-model'

const resolveInstallButtonLabel = (params: { isInstalling: boolean }): string => {
  if (params.isInstalling) {
    return 'Installing…'
  }

  return 'Install xdotool'
}

export const SessionsFocusSupportFooter = (): ReactElement | null => {
  const [focusSupport, setFocusSupport] = useState<SessionFocusSupport | undefined>(undefined)
  const [installErrorMessage, setInstallErrorMessage] = useState('')
  const [isInstalling, setIsInstalling] = useState(false)

  const loadFocusSupport = async (): Promise<void> => {
    try {
      const nextFocusSupport = await sessionsClientService.getSessionFocusSupport()

      setFocusSupport(nextFocusSupport)
    } catch {
      setFocusSupport(undefined)
    }
  }

  const installFocusTool = async (): Promise<void> => {
    setIsInstalling(true)
    setInstallErrorMessage('')

    try {
      const nextFocusSupport = await sessionsClientService.installSessionFocusTool()

      setFocusSupport(nextFocusSupport)
    } catch (error) {
      setInstallErrorMessage(errorUtil.resolveMessage(error))
    }

    setIsInstalling(false)
  }

  useEffect(() => {
    void loadFocusSupport()
  }, [])

  if (focusSupport?.status !== SessionFocusSupportStatusMapper.MISSING_TOOL) {
    return null
  }

  return (
    <footer className="sessions-focus-footer">
      <p className="sessions-focus-footer-message">
        Session focus needs the xdotool tool to activate terminal windows on Linux.
      </p>
      {installErrorMessage !== '' && <p className="sessions-focus-footer-error">{installErrorMessage}</p>}
      <button
        className="button button-primary"
        disabled={isInstalling}
        onClick={() => {
          void installFocusTool()
        }}
        type="button"
      >
        {resolveInstallButtonLabel({ isInstalling })}
      </button>
    </footer>
  )
}
