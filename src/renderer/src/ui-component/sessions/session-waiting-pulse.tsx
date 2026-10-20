import { type ReactElement } from 'react'

export const SessionsSessionWaitingPulse = (props: { isWaiting: boolean }): ReactElement | undefined => {
  const { isWaiting } = props

  if (!isWaiting) {
    return undefined
  }

  return <span className="session-waiting-pulse" />
}
