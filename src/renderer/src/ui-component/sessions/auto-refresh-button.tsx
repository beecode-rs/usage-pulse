import type { ReactElement } from 'react'

import { PauseIcon } from '#src/renderer/src/ui-component/icon/pause-icon'
import { PlayIcon } from '#src/renderer/src/ui-component/icon/play-icon'

const resolveLabel = (params: { isPaused: boolean }): string => {
  const { isPaused } = params
  if (isPaused) {
    return 'Resume sessions auto-refresh'
  }

  return 'Pause sessions auto-refresh'
}

const resolveClassName = (params: { isPaused: boolean }): string => {
  const { isPaused } = params
  if (isPaused) {
    return 'sessions-icon-button is-paused'
  }

  return 'sessions-icon-button'
}

const renderIcon = (params: { isPaused: boolean }): ReactElement => {
  const { isPaused } = params
  if (isPaused) {
    return <PlayIcon />
  }

  return <PauseIcon />
}

export const SessionsAutoRefreshButton = (props: { isPaused: boolean; onToggle: () => void }): ReactElement => {
  const { isPaused, onToggle } = props
  const label = resolveLabel({ isPaused })

  return (
    <button
      aria-label={label}
      className={resolveClassName({ isPaused })}
      onClick={onToggle}
      title={label}
      type="button"
    >
      {renderIcon({ isPaused })}
    </button>
  )
}
