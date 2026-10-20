import type { ReactElement } from 'react'

export const SessionsRefreshProgressBar = (props: { percent: number }): ReactElement => {
  const { percent } = props

  return (
    <div
      aria-label="Time until next sessions refresh"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(percent)}
      className="sessions-progress-track"
      role="meter"
    >
      <div className="sessions-progress-fill" style={{ width: `${String(percent)}%` }} />
    </div>
  )
}
