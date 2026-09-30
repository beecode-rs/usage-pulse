import { type ReactElement, useEffect, useState } from 'react'

import { usageClientService } from '#src/renderer/src/business/service/usage-client-service'
import { MobileConnectHint } from '#src/renderer/src/ui-component/mobile/mobile-connect-hint'
import { MobilePairingTokenField } from '#src/renderer/src/ui-component/mobile/mobile-pairing-token-field'
import { MobileServerPortField } from '#src/renderer/src/ui-component/mobile/mobile-server-port-field'
import { MobileServerToggle } from '#src/renderer/src/ui-component/mobile/mobile-server-toggle'
import '#src/renderer/src/ui-component/mobile/mobile.css'
import '#src/renderer/src/ui-component/usage-dashboard/usage-dashboard.css'
import { errorUtil } from '#src/renderer/src/util/error-util'
import { type SettingsData, SettingsModel } from '#src/shared/business/model/settings-model'

export const MobilePage = (): ReactElement => {
  const [settings, setSettings] = useState<SettingsModel | undefined>(undefined)
  const [portText, setPortText] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const loadedSettings = await usageClientService.getSettings()

        setSettings(loadedSettings)
        setPortText(String(loadedSettings.mobileServerPort))
      } catch (error) {
        setErrorMessage(errorUtil.resolveMessage(error))
      }
    }

    void loadSettings()
  }, [])

  const saveUpdatedSettings = async (params: {
    update: (settingsData: SettingsData) => SettingsData
  }): Promise<void> => {
    const { update } = params

    if (settings === undefined) {
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      const savedSettings = await usageClientService.saveSettings({
        settings: new SettingsModel({ settings: update(settings) }),
      })

      setSettings(savedSettings)
      setPortText(String(savedSettings.mobileServerPort))
    } catch (error) {
      setErrorMessage(errorUtil.resolveMessage(error))
      setIsSaving(false)

      return
    }

    setIsSaving(false)
  }

  const handleToggleEnabled = (isEnabled: boolean): void => {
    void saveUpdatedSettings({
      update: (settingsData) => {
        return { ...settingsData, isMobileServerEnabled: isEnabled }
      },
    })
  }

  const handlePortTextCommit = (params: { portText: string }): void => {
    const { portText: committedPortText } = params
    const port = Number.parseInt(committedPortText, 10)

    if (settings === undefined) {
      return
    }

    if (!Number.isFinite(port)) {
      setPortText(String(settings.mobileServerPort))

      return
    }

    if (port === settings.mobileServerPort) {
      return
    }

    void saveUpdatedSettings({
      update: (settingsData) => {
        return { ...settingsData, mobileServerPort: port }
      },
    })
  }

  const handleRegenerateToken = (): void => {
    void saveUpdatedSettings({
      update: (settingsData) => {
        return { ...settingsData, mobileServerToken: '' }
      },
    })
  }

  if (settings === undefined) {
    return (
      <div className="mobile">
        <p className="provider-card-message">Loading mobile settings…</p>
      </div>
    )
  }

  return (
    <div className="mobile">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Mobile</h1>
          <p className="dashboard-subtitle">Serve live usage and session data to the Usage Pulse mobile app.</p>
        </div>
        <MobileServerToggle isEnabled={settings.isMobileServerEnabled} onToggle={handleToggleEnabled} />
      </header>
      <section className="mobile-card">
        <MobileServerPortField
          onPortTextChange={setPortText}
          onPortTextCommit={handlePortTextCommit}
          portText={portText}
        />
        <MobilePairingTokenField onRegenerateToken={handleRegenerateToken} token={settings.mobileServerToken} />
        <MobileConnectHint />
        {isSaving && <p className="mobile-saving">Saving…</p>}
        {errorMessage !== '' && <p className="settings-error">{errorMessage}</p>}
      </section>
    </div>
  )
}
