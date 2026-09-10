import { type ReactElement } from 'react'

import { SessionSoundUtil } from '#src/renderer/src/util/session-sound-util'
import { SessionSoundId } from '#src/shared/settings-model'

const SESSION_SOUND_OPTIONS: { label: string; soundId: SessionSoundId }[] = [
  { label: 'None', soundId: SessionSoundId.NONE },
  { label: 'Beep', soundId: SessionSoundId.BEEP },
  { label: 'Chime', soundId: SessionSoundId.CHIME },
  { label: 'Ding', soundId: SessionSoundId.DING },
  { label: 'Fanfare', soundId: SessionSoundId.FANFARE },
  { label: 'Ping', soundId: SessionSoundId.PING },
  { label: 'Success', soundId: SessionSoundId.SUCCESS },
]

const renderPlayIcon = (): ReactElement => {
  return (
    <svg fill="currentColor" height="12" viewBox="0 0 24 24" width="12">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

export const SessionSoundField = (props: {
  hint: string
  label: string
  onSoundIdChange: (soundId: SessionSoundId) => void
  playButtonTitle: string
  soundId: SessionSoundId
  volumePercent: number
}): ReactElement => {
  const handlePlaySound = (): void => {
    new SessionSoundUtil().playSessionSound({ soundId: props.soundId, volumePercent: props.volumePercent })
  }

  return (
    <div className="settings-field">
      <span className="settings-field-label">{props.label}</span>
      <div className="sessions-settings-sound-row">
        <select
          className="settings-field-input"
          onChange={(event) => {
            props.onSoundIdChange(event.target.value as SessionSoundId)
          }}
          value={props.soundId}
        >
          {SESSION_SOUND_OPTIONS.map((option) => {
            return (
              <option key={option.soundId} value={option.soundId}>
                {option.label}
              </option>
            )
          })}
        </select>
        <button
          aria-label={props.playButtonTitle}
          className="sessions-settings-play-button"
          disabled={props.soundId === SessionSoundId.NONE}
          onClick={handlePlaySound}
          title={props.playButtonTitle}
          type="button"
        >
          {renderPlayIcon()}
        </button>
      </div>
      <span className="settings-hint">{props.hint}</span>
    </div>
  )
}
