import type { ReactElement } from 'react'

const resolveLabel = (params: { isPaused: boolean }): string => {
  const { isPaused } = params
  if (isPaused) {
    return 'Paused'
  }

  return 'Live'
}

const resolveClassName = (params: { isPaused: boolean }): string => {
  const { isPaused } = params
  if (isPaused) {
    return 'sessions-auto-refresh-status is-paused'
  }

  return 'sessions-auto-refresh-status is-live'
}

export const SessionsAutoRefreshStatus = (props: { isPaused: boolean }): ReactElement => {
  const { isPaused } = props

  return <span className={resolveClassName({ isPaused })}>{resolveLabel({ isPaused })}</span>
}
