import { type ReactElement, useEffect, useState } from 'react'

import { sessionsClientService } from '#src/renderer/src/business/service/sessions-client-service'
import { errorUtil } from '#src/renderer/src/util/error-util'

const resolveInstallButtonLabel = (params: { isInstalling: boolean }): string => {
  const { isInstalling } = params
  if (isInstalling) {
    return 'Installing…'
  }

  return 'Install xdotool'
}

export const SessionsFocusSupportFooter = (): ReactElement | null => {
  const [isFocusToolMissing, setIsFocusToolMissing] = useState(false)
  const [installErrorMessage, setInstallErrorMessage] = useState('')
  const [isInstalling, setIsInstalling] = useState(false)

  const loadFocusSupport = async (): Promise<void> => {
    try {
      const isFocusSupported = await sessionsClientService.isSessionFocusSupported()

      setIsFocusToolMissing(!isFocusSupported)
    } catch {
      setIsFocusToolMissing(false)
    }
  }

  const installFocusTool = async (): Promise<void> => {
    setIsInstalling(true)
    setInstallErrorMessage('')

    try {
      await sessionsClientService.installSessionFocusTool()
      await loadFocusSupport()
    } catch (error) {
      setInstallErrorMessage(errorUtil.resolveMessage(error))
    }

    setIsInstalling(false)
  }

  useEffect(() => {
    void loadFocusSupport()
  }, [])

  if (!isFocusToolMissing) {
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
