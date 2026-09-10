import { SessionSoundUtil } from '#src/renderer/src/util/session-sound-util'
import { type ISessionInfo } from '#src/shared/session-model'

const MILLISECONDS_PER_SECOND = 1000

export const sessionFinishedPulseUtil = {
  resolveFinishedAtBySessionId: (params: {
    currentSessions: ISessionInfo[]
    finishedAtBySessionId: Record<string, number>
    nowMs: number
    previousSessions?: ISessionInfo[]
  }): Record<string, number> => {
    const idleSessionIds = new Set(
      params.currentSessions
        .filter((session) => {
          return session.status === 'idle'
        })
        .map((session) => {
          return session.sessionId
        }),
    )
    const keptEntries = Object.entries(params.finishedAtBySessionId).filter(([sessionId]) => {
      return idleSessionIds.has(sessionId)
    })
    const finishedEntries = new SessionSoundUtil()
      .resolveStatusTransitionSessionIds({
        currentSessions: params.currentSessions,
        fromStatus: 'busy',
        previousSessions: params.previousSessions,
        toStatus: 'idle',
      })
      .map((sessionId): [string, number] => {
        return [sessionId, params.nowMs]
      })

    return Object.fromEntries([...keptEntries, ...finishedEntries])
  },

  resolveIsPulsing: (params: { finishedAtMs?: number; nowMs: number; pulseSeconds: number }): boolean => {
    if (params.finishedAtMs === undefined || params.pulseSeconds <= 0) {
      return false
    }

    return params.nowMs - params.finishedAtMs < params.pulseSeconds * MILLISECONDS_PER_SECOND
  },
}
