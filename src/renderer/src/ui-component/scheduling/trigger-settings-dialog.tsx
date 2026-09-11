import { type ReactElement, useEffect, useState } from 'react'

import { usageClientService } from '#src/renderer/src/business/service/usage-client-service'
import { TriggerConfigFields } from '#src/renderer/src/ui-component/scheduling/trigger-config-fields'
import { errorUtil } from '#src/renderer/src/util/error-util'
import { triggerValidationUtil } from '#src/renderer/src/util/trigger-validation-util'
import { type ScheduleTriggerConfig } from '#src/shared/business/model/schedule-trigger-model'
import { type AppSettings } from '#src/shared/business/model/settings-model'

export const TriggerSettingsDialog = (props: {
  onClose: () => void
  onSaved: () => void
  triggerId: string
}): ReactElement => {
  const { onClose, onSaved, triggerId } = props
  const [editedTrigger, setEditedTrigger] = useState<ScheduleTriggerConfig | undefined>(undefined)
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTriggerMissing, setIsTriggerMissing] = useState(false)
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      const loadedSettings = await usageClientService.getSettings()
      const loadedTrigger = loadedSettings.triggers.find((trigger) => {
        return trigger.id === triggerId
      })

      setSettings(loadedSettings)

      if (loadedTrigger === undefined) {
        setIsTriggerMissing(true)

        return
      }

      setEditedTrigger(loadedTrigger)
    }

    void loadSettings()
  }, [triggerId])

  const handleSave = async (): Promise<void> => {
    if (settings === undefined || editedTrigger === undefined) {
      return
    }

    const validationError = triggerValidationUtil.resolveValidationError({ trigger: editedTrigger })

    if (validationError !== undefined) {
      setErrorMessage(validationError)

      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      await usageClientService.saveSettings({
        settings: {
          ...settings,
          triggers: settings.triggers.map((trigger) => {
            if (trigger.id !== editedTrigger.id) {
              return trigger
            }

            return editedTrigger
          }),
        },
      })
    } catch (error) {
      setErrorMessage(errorUtil.resolveMessage(error))
      setIsSaving(false)
      const currentSettings = await usageClientService.getSettings()

      setSettings(currentSettings)

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

    if (settings === undefined || editedTrigger === undefined) {
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      await usageClientService.saveSettings({
        settings: {
          ...settings,
          triggers: settings.triggers.filter((trigger) => {
            return trigger.id !== editedTrigger.id
          }),
        },
      })
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

    return 'Remove trigger'
  }

  if (settings === undefined) {
    return (
      <div className="settings-overlay">
        <section className="settings-panel">
          <p className="provider-card-message">Loading settings…</p>
        </section>
      </div>
    )
  }

  if (isTriggerMissing || editedTrigger === undefined) {
    return (
      <div className="settings-overlay">
        <section className="settings-panel">
          <header className="settings-panel-header">
            <h2 className="settings-panel-title">Trigger settings</h2>
            <button className="button" onClick={onClose} type="button">
              Close
            </button>
          </header>
          <p className="settings-hint">This trigger no longer exists.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="settings-overlay">
      <section className="settings-panel">
        <header className="settings-panel-header">
          <h2 className="settings-panel-title">Trigger settings</h2>
          <button className="button" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="settings-panel-body">
          <TriggerConfigFields config={editedTrigger} onChange={setEditedTrigger} />
          {errorMessage !== '' && <p className="settings-error">{errorMessage}</p>}
        </div>
        <div className="settings-dialog-actions">
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
        </div>
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
            <p className="settings-hint">
              This removes the OS registration and the trigger. The action cannot be undone.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
