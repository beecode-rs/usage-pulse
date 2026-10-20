import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'
import { sessionStatusTransitionService } from '#src/shared/business/service/session-status-transition-service'

export const sessionFinishedPulseService = {
  isPulsing: (params: { finishedAtMs?: number; nowMs: number; pulseMs: number }): boolean => {
    const { finishedAtMs, nowMs, pulseMs } = params
    if (finishedAtMs === undefined || pulseMs <= 0) {
      return false
    }

    return nowMs - finishedAtMs < pulseMs
  },

  resolveFinishedAtBySessionId: (params: {
    currentSessions: SessionInfo[]
    finishedAtBySessionId: Record<string, number>
    nowMs: number
    previousSessions?: SessionInfo[]
  }): Record<string, number> => {
    const { currentSessions, finishedAtBySessionId, nowMs, previousSessions } = params
    const idleSessionIds = new Set(
      currentSessions
        .filter((session) => {
          return session.status === SessionStatusMapper.IDLE
        })
        .map((session) => {
          return session.sessionId
        }),
    )
    const keptEntries = Object.entries(finishedAtBySessionId).filter(([sessionId]) => {
      return idleSessionIds.has(sessionId)
    })
    const finishedEntries = sessionStatusTransitionService
      .resolveStatusTransitionSessionIds({
        currentSessions,
        fromStatus: SessionStatusMapper.BUSY,
        previousSessions,
        toStatus: SessionStatusMapper.IDLE,
      })
      .map((sessionId): [string, number] => {
        return [sessionId, nowMs]
      })

    return Object.fromEntries([...keptEntries, ...finishedEntries])
  },
}
