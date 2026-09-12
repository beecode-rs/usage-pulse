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
    const finishedEntries = new SessionSoundUtil()
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

  resolveIsPulsing: (params: { finishedAtMs?: number; nowMs: number; pulseMs: number }): boolean => {
    const { finishedAtMs, nowMs, pulseMs } = params
    if (finishedAtMs === undefined || pulseMs <= 0) {
      return false
    }

    return nowMs - finishedAtMs < pulseMs
  },
}
