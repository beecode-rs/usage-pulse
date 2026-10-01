import { type SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'

export const sessionStatusTransitionUtil = {
  resolveNewlyStatusSessionIds(params: {
    currentSessions: SessionInfo[]
    previousSessions?: SessionInfo[]
    status: SessionStatusMapper
  }): string[] {
    const { currentSessions, previousSessions, status } = params
    if (previousSessions === undefined) {
      return []
    }

    const statusSessionIds = new Set(
      previousSessions
        .filter((session) => {
          return session.status === status
        })
        .map((session) => {
          return session.sessionId
        }),
    )

    return currentSessions
      .filter((session) => {
        return session.status === status && !statusSessionIds.has(session.sessionId)
      })
      .map((session) => {
        return session.sessionId
      })
  },

  resolveStatusTransitionSessionIds(params: {
    currentSessions: SessionInfo[]
    fromStatus: SessionStatusMapper
    previousSessions?: SessionInfo[]
    toStatus: SessionStatusMapper
  }): string[] {
    const { currentSessions, fromStatus, previousSessions, toStatus } = params
    if (previousSessions === undefined) {
      return []
    }

    const fromStatusSessionIds = new Set(
      previousSessions
        .filter((session) => {
          return session.status === fromStatus
        })
        .map((session) => {
          return session.sessionId
        }),
    )

    return currentSessions
      .filter((session) => {
        return session.status === toStatus && fromStatusSessionIds.has(session.sessionId)
      })
      .map((session) => {
        return session.sessionId
      })
  },
}
