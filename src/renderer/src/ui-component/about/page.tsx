import { type ReactElement, useEffect, useState } from 'react'

import appIconUrl from '#resource/icon/app-icon.png'
import { updateClientService } from '#src/renderer/src/business/service/update-client-service'
import '#src/renderer/src/ui-component/about/about-page.css'
import { constant } from '#src/renderer/src/util/constant'
import type { UpdateStatus } from '#src/shared/business/model/update-model'
import { updateCheckErrorMessageService } from '#src/shared/business/service/update-check-error-message-service'
import { constant as sharedConstant } from '#src/shared/util/constant'
import { errorUtil } from '#src/shared/util/error-util'

const resolveCheckButtonLabel = (params: { isChecking: boolean }): string => {
  const { isChecking } = params

  if (isChecking) {
    return 'Checking…'
  }

  return 'Check for updates'
}

const resolveUpdateStatusText = (params: {
  checkErrorMessage: string
  isChecking: boolean
  status: UpdateStatus | undefined
}): string => {
  const { checkErrorMessage, isChecking, status } = params

  if (isChecking) {
    return 'Checking for updates…'
  }

  if (checkErrorMessage !== '') {
    return checkErrorMessage
  }

  if (status === undefined) {
    return ''
  }

  if (status.error !== undefined) {
    return updateCheckErrorMessageService.resolveMessage({ error: status.error })
  }

  if (status.isUpdateAvailable && status.latestVersion !== undefined) {
    return `Version ${status.latestVersion} is available`
  }

  return `Up to date (v${status.currentVersion})`
}

export const AboutPage = (props: { onToggleDevelopmentUnlock: () => void }): ReactElement => {
  const { onToggleDevelopmentUnlock } = props
  const [checkErrorMessage, setCheckErrorMessage] = useState<string>('')
  const [developmentClicksRemaining, setDevelopmentClicksRemaining] = useState<number>(
    constant.aboutPage.developmentUnlockClickCount,
  )
  const [isCheckingForUpdate, setIsCheckingForUpdate] = useState<boolean>(false)
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

  const handleCheckForUpdates = (): void => {
    setIsCheckingForUpdate(true)

    void updateClientService
      .checkForUpdate()
      .then((nextStatus) => {
        setCheckErrorMessage('')
        setStatus(nextStatus)
      })
      .catch((error: unknown) => {
        setCheckErrorMessage(errorUtil.resolveMessage(error))
      })
      .finally(() => {
        setIsCheckingForUpdate(false)
      })
  }

  const handleTitleClick = (): void => {
    const nextClicksRemaining = developmentClicksRemaining - 1

    if (nextClicksRemaining > 0) {
      setDevelopmentClicksRemaining(nextClicksRemaining)

      return
    }

    setDevelopmentClicksRemaining(constant.aboutPage.developmentUnlockClickCount)
    onToggleDevelopmentUnlock()
  }

  const resolveDevelopmentHintText = (): string => {
    if (developmentClicksRemaining === 1) {
      return '1 more click to toggle the Development tab'
    }

    return `${String(developmentClicksRemaining)} more clicks to toggle the Development tab`
  }

  const updateStatusText = resolveUpdateStatusText({
    checkErrorMessage,
    isChecking: isCheckingForUpdate,
    status,
  })

  return (
    <div className="about-page">
      <header>
        <img alt="Usage Pulse app icon" className="about-page-icon" src={appIconUrl} />
        <h1 className="about-page-title" onClick={handleTitleClick}>
          {constant.app.title}
        </h1>
        {developmentClicksRemaining < constant.aboutPage.developmentUnlockClickCount && (
          <p className="about-page-development-hint">{resolveDevelopmentHintText()}</p>
        )}
        <p className="about-page-tagline">Desktop tracker for Claude and z.ai coding-plan usage limits.</p>
        {status !== undefined && <p className="about-page-version">Version {status.currentVersion}</p>}
      </header>
      <section className="about-page-section">
        <h2 className="about-page-section-title">Updates</h2>
        <div className="about-page-updates">
          <button
            className="about-page-update-button"
            disabled={isCheckingForUpdate}
            onClick={handleCheckForUpdates}
            type="button"
          >
            {resolveCheckButtonLabel({ isChecking: isCheckingForUpdate })}
          </button>
          {updateStatusText !== '' && <p className="about-page-update-status">{updateStatusText}</p>}
        </div>
      </section>
      <section className="about-page-section">
        <h2 className="about-page-section-title">What it does</h2>
        <p className="about-page-text">
          Usage Pulse polls each configured tracker at a fixed interval and shows how much of your plan&apos;s usage
          allowance has been consumed across the current billing and session windows.
        </p>
      </section>
      <section className="about-page-section">
        <h2 className="about-page-section-title">Supported providers</h2>
        <ul className="about-page-provider-list">
          {sharedConstant.providerCatalog.map((catalogEntry) => {
            return (
              <li className="about-page-provider" key={catalogEntry.id}>
                <span className="about-page-provider-name">{catalogEntry.name}</span>
                <span className="about-page-provider-description">{catalogEntry.description}</span>
              </li>
            )
          })}
        </ul>
      </section>
      <section className="about-page-section">
        <h2 className="about-page-section-title">Privacy</h2>
        <p className="about-page-text">
          Access tokens and usage data stay on this machine — requests go straight from the app to each provider, with
          no intermediary servers.
        </p>
      </section>
    </div>
  )
}
