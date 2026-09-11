import { SessionSoundUtil } from '#src/renderer/src/util/session-sound-util'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'

export const sessionFinishedPulseUtil = {
  resolveFinishedAtBySessionId: (params: {
    currentSessions: SessionInfo[]
    finishedAtBySessionId: Record<string, number>
    nowMs: number
    previousSessions?: SessionInfo[]
  }): Record<string, number> => {
    const idleSessionIds = new Set(
      params.currentSessions
        .filter((session) => {
          return session.status === SessionStatusMapper.IDLE
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
        fromStatus: SessionStatusMapper.BUSY,
        previousSessions: params.previousSessions,
        toStatus: SessionStatusMapper.IDLE,
      })
      .map((sessionId): [string, number] => {
        return [sessionId, params.nowMs]
      })

    return Object.fromEntries([...keptEntries, ...finishedEntries])
  },

  resolveIsPulsing: (params: { finishedAtMs?: number; nowMs: number; pulseMs: number }): boolean => {
    if (params.finishedAtMs === undefined || params.pulseMs <= 0) {
      return false
    }

    return params.nowMs - params.finishedAtMs < params.pulseMs
  },
}
