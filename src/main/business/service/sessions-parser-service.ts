import { objectUtil } from '#src/main/util/object-util'
import { type ISessionInfo, type SessionStatus } from '#src/shared/session-model'

const SESSION_ORIGIN_ORDER = {
  local: 0,
  ssh: 1,
}

export const sessionsParserService = {
  _resolveSessionInfo: (params: { rawEntry: unknown }): ISessionInfo | undefined => {
    const rawRecord = objectUtil.asRecord(params.rawEntry)

    if (rawRecord === undefined) {
      return undefined
    }

    const pid = rawRecord['pid']

    if (typeof pid !== 'number') {
      return undefined
    }

    const startedAt = rawRecord['startedAt']

    if (typeof startedAt !== 'number') {
      return undefined
    }

    const sessionId = rawRecord['sessionId']

    if (typeof sessionId !== 'string') {
      return undefined
    }

    return {
      cwd: sessionsParserService._resolveStringValue(rawRecord['cwd']),
      kind: sessionsParserService._resolveStringValue(rawRecord['kind']),
      name: sessionsParserService._resolveStringValue(rawRecord['name']),
      pid,
      sessionId,
      startedAt,
      status: sessionsParserService._resolveSessionStatus(rawRecord['status']),
    }
  },

  _resolveSessionOriginOrder: (session: ISessionInfo): number => {
    if (session.hostId === undefined) {
      return SESSION_ORIGIN_ORDER.local
    }

    return SESSION_ORIGIN_ORDER.ssh
  },

  _resolveSessionStatus: (value: unknown): SessionStatus => {
    switch (value) {
      case 'busy': {
        return 'busy'
      }

      case 'idle': {
        return 'idle'
      }

      case 'waiting': {
        return 'waiting'
      }

      default: {
        return 'unknown'
      }
    }
  },

  _resolveStringValue: (value: unknown): string => {
    if (typeof value === 'string') {
      return value
    }

    return ''
  },

  _sanitizeSessions: (params: { rawEntries: unknown[] }): ISessionInfo[] => {
    return params.rawEntries
      .map((rawEntry) => {
        return sessionsParserService._resolveSessionInfo({ rawEntry })
      })
      .filter((session): session is ISessionInfo => {
        return session !== undefined
      })
  },

  _tryParseSessionsJson: (params: { stdout: string }): unknown => {
    try {
      return JSON.parse(params.stdout)
    } catch {
      return sessionsParserService._tryParseSessionsJsonSlice({ stdout: params.stdout })
    }
  },

  _tryParseSessionsJsonSlice: (params: { stdout: string }): unknown => {
    const startIndex = params.stdout.indexOf('[')
    const endIndex = params.stdout.lastIndexOf(']')

    if (startIndex < 0 || endIndex <= startIndex) {
      throw new Error("'claude agents --json' printed output that is not valid JSON")
    }

    try {
      return JSON.parse(params.stdout.slice(startIndex, endIndex + 1))
    } catch {
      throw new Error("'claude agents --json' printed output that is not valid JSON")
    }
  },

  parseSessionEntries: (params: { stdout: string }): ISessionInfo[] => {
    const parsed = sessionsParserService._tryParseSessionsJson({ stdout: params.stdout })

    if (!Array.isArray(parsed)) {
      throw new Error("'claude agents --json' printed unexpected output: expected a JSON array of sessions")
    }

    return sessionsParserService._sanitizeSessions({ rawEntries: parsed })
  },

  sortSessions: (sessions: ISessionInfo[]): ISessionInfo[] => {
    return [...sessions].sort((left, right) => {
      const originOrderDiff =
        sessionsParserService._resolveSessionOriginOrder(left) - sessionsParserService._resolveSessionOriginOrder(right)

      if (originOrderDiff !== 0) {
        return originOrderDiff
      }

      return left.name.localeCompare(right.name)
    })
  },
}
