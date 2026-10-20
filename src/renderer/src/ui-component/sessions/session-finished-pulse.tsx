import { type CSSProperties, type ReactElement } from 'react'

import { sessionFinishedPulseService } from '#src/renderer/src/business/service/session-finished-pulse-service'

const resolvePulseStyle = (params: { pulseMs: number }): CSSProperties => {
  const { pulseMs } = params

  return { animationDuration: `${String(pulseMs)}ms` }
}

export const SessionsSessionFinishedPulse = (props: {
  finishedAtMs?: number
  nowMs: number
  pulseMs: number
}): ReactElement | undefined => {
  const { finishedAtMs, nowMs, pulseMs } = props

  if (!sessionFinishedPulseService.isPulsing(props)) {
    return undefined
  }

  return <span className="session-finished-pulse" key={finishedAtMs} style={resolvePulseStyle({ pulseMs })} />
}
