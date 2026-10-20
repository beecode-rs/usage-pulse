import { type ReactElement } from 'react'

import { SessionSoundService } from '#src/renderer/src/business/service/session-sound-service'
import { constant } from '#src/renderer/src/util/constant'
import { SoundNameMapper } from '#src/shared/business/enum/sound-name-mapper-enum'

const renderPlayIcon = (): ReactElement => {
  return (
    <svg fill="currentColor" height="12" viewBox="0 0 24 24" width="12">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

export const SessionsSessionSoundField = (props: {
  hint: string
  label: string
  onSoundIdChange: (soundId: SoundNameMapper) => void
  playButtonTitle: string
  soundId: SoundNameMapper
  volumePercent: number
}): ReactElement => {
  const { hint, label, onSoundIdChange, playButtonTitle, soundId, volumePercent } = props

  const handlePlaySound = (): void => {
    new SessionSoundService().playSessionSound({ soundId, volumePercent })
  }

  return (
    <div className="settings-field">
      <span className="settings-field-label">{label}</span>
      <div className="sessions-settings-sound-row">
        <select
          className="settings-field-input"
          onChange={(event) => {
            onSoundIdChange(event.target.value as SoundNameMapper)
          }}
          value={soundId}
        >
          {constant.sound.selectOptions.map((option) => {
            return (
              <option key={option.soundId} value={option.soundId}>
                {option.label}
              </option>
            )
          })}
        </select>
        <button
          aria-label={playButtonTitle}
          className="sessions-settings-play-button"
          disabled={soundId === SoundNameMapper.NONE}
          onClick={handlePlaySound}
          title={playButtonTitle}
          type="button"
        >
          {renderPlayIcon()}
        </button>
      </div>
      <span className="settings-hint">{hint}</span>
    </div>
  )
}
