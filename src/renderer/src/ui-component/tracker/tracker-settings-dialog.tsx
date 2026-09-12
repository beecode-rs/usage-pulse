import { type ReactElement, useEffect, useState } from 'react'

import { osClientService } from '#src/renderer/src/business/service/os-client-service'
import { usageClientService } from '#src/renderer/src/business/service/usage-client-service'
import { TrackerConfigFields } from '#src/renderer/src/ui-component/tracker/tracker-config-fields'
import { errorUtil } from '#src/renderer/src/util/error-util'
import { trackerAccessTokenSourceUtil } from '#src/renderer/src/util/tracker-access-token-source-util'
import type { OS } from '#src/shared/business/enum/os-enum'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { type AppSettings, type TrackerConfig } from '#src/shared/business/model/settings-model'

export const TrackerSettingsDialog = (props: {
  onClose: () => void
  onSaved: () => void
  trackerId: string
}): ReactElement => {
  const { onClose, onSaved, trackerId } = props
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined)
  const [tracker, setTracker] = useState<TrackerConfig | undefined>(undefined)
  const [osPlatform, setOsPlatform] = useState<OS | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      const [loadedSettings, loadedOsPlatform] = await Promise.all([
        usageClientService.getSettings(),
        osClientService.getPlatform(),
      ])
      const loadedTracker = loadedSettings.trackers.find((settingsTracker) => {
        return settingsTracker.id === trackerId
      })

      setOsPlatform(loadedOsPlatform)
      setSettings(loadedSettings)

      if (loadedTracker === undefined) {
        setTracker(undefined)

        return
      }

      setTracker(trackerAccessTokenSourceUtil.normalizeConfig({ config: loadedTracker, osPlatform: loadedOsPlatform }))
    }

    void loadSettings()
  }, [trackerId])

  const resolveTrackerValidationError = (candidate: TrackerConfig): string | undefined => {
    if (candidate.providerId !== ProviderIdMapper.DUMMY) {
      return undefined
    }

    if (candidate.days.length === 0) {
      return 'Pick at least one day for this tracker.'
    }

    if (candidate.times.length === 0) {
      return 'Add at least one time for this tracker.'
    }

    return undefined
  }

  const handleSave = async (): Promise<void> => {
    if (settings === undefined || tracker === undefined) {
      return
    }

    const validationError = resolveTrackerValidationError(tracker)

    if (validationError !== undefined) {
      setErrorMessage(validationError)

      return
    }

    const nextTrackers = settings.trackers.map((settingsTracker) => {
      if (settingsTracker.id === tracker.id) {
        return tracker
      }

      return settingsTracker
    })

    setIsSaving(true)
    setErrorMessage('')

    try {
      await usageClientService.saveSettings({ settings: { ...settings, trackers: nextTrackers } })
    } catch (error) {
      setErrorMessage(errorUtil.resolveMessage(error))
      setIsSaving(false)

      return
    }

    setIsSaving(false)
    onSaved()
    onClose()
  }

  const handleRemove = async (): Promise<void> => {
    if (!isConfirmingRemove) {
      setIsConfirmingRemove(true)

      return
    }

    if (settings === undefined || tracker === undefined) {
      return
    }

    const nextTrackers = settings.trackers.filter((settingsTracker) => {
      return settingsTracker.id !== tracker.id
    })

    setIsSaving(true)
    setErrorMessage('')

    try {
      await usageClientService.saveSettings({ settings: { ...settings, trackers: nextTrackers } })
    } catch (error) {
      setErrorMessage(errorUtil.resolveMessage(error))
      setIsSaving(false)
      setIsConfirmingRemove(false)

      return
    }

    setIsSaving(false)
    onSaved()
    onClose()
  }

  const resolveRemoveButtonText = (): string => {
    if (isConfirmingRemove) {
      return 'Confirm remove'
    }

    return 'Remove tracker'
  }

  if (settings === undefined || osPlatform === undefined) {
    return (
      <div className="settings-overlay">
        <section className="settings-panel">
          <p className="provider-card-message">Loading settings…</p>
        </section>
      </div>
    )
  }

  if (tracker === undefined) {
    return (
      <div className="settings-overlay">
        <section className="settings-panel">
          <header className="settings-panel-header">
            <h2 className="settings-panel-title">Tracker settings</h2>
            <button className="button" onClick={onClose} type="button">
              Close
            </button>
          </header>
          <p className="provider-card-message">This tracker no longer exists.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="settings-overlay">
      <section className="settings-panel">
        <header className="settings-panel-header">
          <h2 className="settings-panel-title">Tracker settings</h2>
          <button className="button" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <TrackerConfigFields config={tracker} onChange={setTracker} osPlatform={osPlatform} />
        {errorMessage !== '' && <p className="settings-error">{errorMessage}</p>}
        <p className="settings-hint">
          The token is stored locally in your user data folder and sent only to the provider this tracker belongs to.
        </p>
        <button
          className="button button-primary"
          disabled={isSaving}
          onClick={() => {
            void handleSave()
          }}
          type="button"
        >
          Save
        </button>
        <div className="settings-danger-zone">
          <button
            className="button button-danger"
            disabled={isSaving}
            onClick={() => {
              void handleRemove()
            }}
            type="button"
          >
            {resolveRemoveButtonText()}
          </button>
          {isConfirmingRemove && (
            <p className="settings-hint">This deletes the tracker and its token. The action cannot be undone.</p>
          )}
        </div>
      </section>
    </div>
  )
}
