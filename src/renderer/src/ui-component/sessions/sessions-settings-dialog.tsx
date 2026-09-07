import { type ReactElement, useEffect, useState } from 'react'

import { usageClientService } from '#src/renderer/src/business/service/usage-client-service'
import { SessionSoundField } from '#src/renderer/src/ui-component/sessions/session-sound-field'
import { errorUtil } from '#src/renderer/src/util/error-util'
import { SettingsModel } from '#src/shared/business/model/settings-model'
import { constant } from '#src/shared/util/constant'

const resolveClampedSecondsAsMs = (params: { maxMs: number; minMs: number; seconds: number }): number => {
  const { maxMs, minMs, seconds } = params
  const secondsAsMs = seconds * 1000

  return Math.min(Math.max(secondsAsMs, minMs), maxMs)
}

const renderCloseIcon = (): ReactElement => {
  return (
    <svg
      fill="none"
      height="15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="15"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export const SessionsSettingsDialog = (props: { onClose: () => void; onSaved: () => void }): ReactElement => {
  const { onClose, onSaved } = props
  const [settings, setSettings] = useState<SettingsModel | undefined>(undefined)
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(constant.sessionsRefreshInterval.defaultMs)
  const [sessionFinishedPulseMs, setSessionFinishedPulseMs] = useState<number>(constant.sessionFinishedPulse.defaultMs)
  const [sessionFinishedSoundId, setSessionFinishedSoundId] = useState(constant.sessionFinishedSound.defaultId)
  const [waitingSoundId, setWaitingSoundId] = useState(constant.waitingSound.defaultId)
  const [soundVolumePercent, setSoundVolumePercent] = useState<number>(constant.soundVolume.defaultPercent)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      const loadedSettings = await usageClientService.getSettings()

      setSettings(loadedSettings)
      setRefreshIntervalMs(loadedSettings.sessionsRefreshIntervalMs)
      setSessionFinishedPulseMs(loadedSettings.sessionFinishedPulseMs)
      setSessionFinishedSoundId(loadedSettings.sessionFinishedSoundId)
      setWaitingSoundId(loadedSettings.waitingSoundId)
      setSoundVolumePercent(loadedSettings.soundVolumePercent)
    }

    void loadSettings()
  }, [])

  const handleSave = async (): Promise<void> => {
    if (settings === undefined) {
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      await usageClientService.saveSettings({
        settings: new SettingsModel({
          settings: {
            ...settings,
            sessionFinishedPulseMs,
            sessionFinishedSoundId,
            sessionsRefreshIntervalMs: refreshIntervalMs,
            soundVolumePercent,
            waitingSoundId,
          },
        }),
      })
    } catch (error) {
      setErrorMessage(errorUtil.resolveMessage(error))
      setIsSaving(false)

      return
    }

    setIsSaving(false)
    onSaved()
    onClose()
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

  return (
    <div className="settings-overlay">
      <section className="settings-panel">
        <header className="settings-panel-header">
          <h2 className="settings-panel-title">Sessions settings</h2>
          <button aria-label="Close" className="sessions-close-button" onClick={onClose} title="Close" type="button">
            {renderCloseIcon()}
          </button>
        </header>
        <label className="settings-field">
          <span className="settings-field-label">Auto-refresh interval (seconds)</span>
          <input
            className="settings-field-input"
            max={constant.sessionsRefreshInterval.maxMs / 1000}
            min={constant.sessionsRefreshInterval.minMs / 1000}
            onChange={(event) => {
              const seconds = Number.parseInt(event.target.value, 10)

              if (!Number.isFinite(seconds)) {
                return
              }

              setRefreshIntervalMs(
                resolveClampedSecondsAsMs({
                  maxMs: constant.sessionsRefreshInterval.maxMs,
                  minMs: constant.sessionsRefreshInterval.minMs,
                  seconds,
                }),
              )
            }}
            type="number"
            value={refreshIntervalMs / 1000}
          />
          <span className="settings-hint">
            How often the sessions list refreshes automatically, between{' '}
            {String(constant.sessionsRefreshInterval.minMs / 1000)} and{' '}
            {String(constant.sessionsRefreshInterval.maxMs / 1000)} seconds.
          </span>
        </label>
        <label className="settings-field">
          <span className="settings-field-label">Session finished indicator (seconds)</span>
          <input
            className="settings-field-input"
            max={constant.sessionFinishedPulse.maxMs / 1000}
            min={constant.sessionFinishedPulse.minMs / 1000}
            onChange={(event) => {
              const seconds = Number.parseInt(event.target.value, 10)

              if (!Number.isFinite(seconds)) {
                return
              }

              setSessionFinishedPulseMs(
                resolveClampedSecondsAsMs({
                  maxMs: constant.sessionFinishedPulse.maxMs,
                  minMs: constant.sessionFinishedPulse.minMs,
                  seconds,
                }),
              )
            }}
            type="number"
            value={sessionFinishedPulseMs / 1000}
          />
          <span className="settings-hint">
            How long a finished session card pulses its border from grey to white, fading out over the same rhythm.
            Between {String(constant.sessionFinishedPulse.minMs / 1000)} and{' '}
            {String(constant.sessionFinishedPulse.maxMs / 1000)} seconds, where{' '}
            {String(constant.sessionFinishedPulse.minMs / 1000)} turns the indicator off.
          </span>
        </label>
        <fieldset className="settings-group">
          <legend className="settings-group-title">Sounds</legend>
          <SessionSoundField
            hint="Plays when a Claude session starts waiting for your input."
            label="Waiting sound"
            onSoundIdChange={setWaitingSoundId}
            playButtonTitle="Play waiting sound"
            soundId={waitingSoundId}
            volumePercent={soundVolumePercent}
          />
          <SessionSoundField
            hint="Plays when a Claude session finishes working."
            label="Session finished sound"
            onSoundIdChange={setSessionFinishedSoundId}
            playButtonTitle="Play session finished sound"
            soundId={sessionFinishedSoundId}
            volumePercent={soundVolumePercent}
          />
          <div className="settings-field">
            <span className="settings-field-label">Volume (%)</span>
            <input
              className="sessions-settings-range"
              max={constant.soundVolume.maxPercent}
              min={constant.soundVolume.minPercent}
              onChange={(event) => {
                const volumePercent = Number.parseInt(event.target.value, 10)

                if (!Number.isFinite(volumePercent)) {
                  return
                }

                setSoundVolumePercent(volumePercent)
              }}
              type="range"
              value={soundVolumePercent}
            />
            <span className="settings-hint">
              Loudness of both sounds, between {String(constant.soundVolume.minPercent)} and{' '}
              {String(constant.soundVolume.maxPercent)} percent. Use the play buttons to preview each sound.
            </span>
          </div>
        </fieldset>
        {errorMessage !== '' && <p className="settings-error">{errorMessage}</p>}
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
      </section>
    </div>
  )
}
