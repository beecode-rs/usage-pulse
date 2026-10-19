import { type CSSProperties, type ReactElement } from 'react'

import { sessionFinishedPulseService } from '#src/renderer/src/business/service/session-finished-pulse-service'

const resolvePulseStyle = (params: { pulseMs: number }): CSSProperties => {
  const { pulseMs } = params

  return { animationDuration: `${String(pulseMs)}ms` }
}

export const SessionFinishedPulse = (props: {
  finishedAtMs?: number
  nowMs: number
  pulseMs: number
}): ReactElement | undefined => {
  if (!sessionFinishedPulseService.isPulsing(props)) {
    return undefined
  }

  return (
    <span
      className="session-finished-pulse"
      key={props.finishedAtMs}
      style={resolvePulseStyle({ pulseMs: props.pulseMs })}
    />
  )
}
