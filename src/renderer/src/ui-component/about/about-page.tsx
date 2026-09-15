import { type ReactElement, useEffect, useState } from 'react'

import appIconUrl from '#resource/icon/app-icon.png'
import { updateClientService } from '#src/renderer/src/business/service/update-client-service'
import '#src/renderer/src/ui-component/about/about-page.css'
import { constant } from '#src/shared/util/constant'

const TITLE_CLICKS_TO_TOGGLE_DEVELOPMENT = 7

export const AboutPage = (props: { onToggleDevelopmentUnlock: () => void }): ReactElement => {
  const { onToggleDevelopmentUnlock } = props
  const [developmentClicksRemaining, setDevelopmentClicksRemaining] = useState<number>(
    TITLE_CLICKS_TO_TOGGLE_DEVELOPMENT,
  )
  const [currentVersion, setCurrentVersion] = useState('')

  useEffect(() => {
    const loadCurrentVersion = async (): Promise<void> => {
      try {
        const status = await updateClientService.getStatus()

        setCurrentVersion(status.currentVersion)
      } catch {
        return
      }
    }

    void loadCurrentVersion()
  }, [])

  const handleTitleClick = (): void => {
    const nextClicksRemaining = developmentClicksRemaining - 1

    if (nextClicksRemaining > 0) {
      setDevelopmentClicksRemaining(nextClicksRemaining)

      return
    }

    setDevelopmentClicksRemaining(TITLE_CLICKS_TO_TOGGLE_DEVELOPMENT)
    onToggleDevelopmentUnlock()
  }

  const resolveDevelopmentHintText = (): string => {
    if (developmentClicksRemaining === 1) {
      return '1 more click to toggle the Development tab'
    }

    return `${String(developmentClicksRemaining)} more clicks to toggle the Development tab`
  }

  return (
    <div className="about-page">
      <header>
        <img alt="Usage Pulse app icon" className="about-page-icon" src={appIconUrl} />
        <h1 className="about-page-title" onClick={handleTitleClick}>
          Usage Pulse
        </h1>
        {developmentClicksRemaining < TITLE_CLICKS_TO_TOGGLE_DEVELOPMENT && (
          <p className="about-page-development-hint">{resolveDevelopmentHintText()}</p>
        )}
        <p className="about-page-tagline">Desktop tracker for Claude and z.ai coding-plan usage limits.</p>
        {currentVersion !== '' && <p className="about-page-version">Version {currentVersion}</p>}
      </header>
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
          {constant.providerCatalog.map((catalogEntry) => {
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
