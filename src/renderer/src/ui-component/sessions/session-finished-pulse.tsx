import { type CSSProperties, type ReactElement } from 'react'

import { sessionFinishedPulseUtil } from '#src/renderer/src/util/session-finished-pulse-util'

const resolvePulseStyle = (params: { pulseMs: number }): CSSProperties => {
  return { animationDuration: `${String(params.pulseMs)}ms` }
}

export const SessionFinishedPulse = (props: {
  finishedAtMs?: number
  nowMs: number
  pulseMs: number
}): ReactElement | undefined => {
  if (!sessionFinishedPulseUtil.resolveIsPulsing(props)) {
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
