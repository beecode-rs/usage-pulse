import { objectUtil } from '#src/main/util/object-util'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'

const SESSION_ORIGIN_ORDER = {
  local: 0,
  ssh: 1,
}

export class SessionsParserService {
  parseSessionEntries(params: { stdout: string }): SessionInfo[] {
    const { stdout } = params
    const parsed = this._tryParseSessionsJson({ stdout })

    if (!Array.isArray(parsed)) {
      throw new Error("'claude agents --json' printed unexpected output: expected a JSON array of sessions")
    }

    return this._sanitizeSessions({ rawEntries: parsed })
  }

  sortSessions(sessions: SessionInfo[]): SessionInfo[] {
    return [...sessions].sort((left, right) => {
      const originOrderDiff = this._resolveSessionOriginOrder(left) - this._resolveSessionOriginOrder(right)

      if (originOrderDiff !== 0) {
        return originOrderDiff
      }

      return left.name.localeCompare(right.name)
    })
  }

  protected _resolveSessionInfo(params: { rawEntry: unknown }): SessionInfo | undefined {
    const { rawEntry } = params
    const rawRecord = objectUtil.asRecord(rawEntry)

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
      cwd: this._resolveStringValue(rawRecord['cwd']),
      kind: this._resolveStringValue(rawRecord['kind']),
      name: this._resolveStringValue(rawRecord['name']),
      pid,
      sessionId,
      startedAt,
      status: this._resolveSessionStatus(rawRecord['status']),
    }
  }

  protected _resolveSessionOriginOrder(session: SessionInfo): number {
    if (session.hostId === undefined) {
      return SESSION_ORIGIN_ORDER.local
    }

    return SESSION_ORIGIN_ORDER.ssh
  }

  protected _resolveSessionStatus(value: unknown): SessionStatusMapper {
    switch (value) {
      case 'busy': {
        return SessionStatusMapper.BUSY
      }

      case 'idle': {
        return SessionStatusMapper.IDLE
      }

      case 'waiting': {
        return SessionStatusMapper.WAITING
      }

      default: {
        return SessionStatusMapper.UNKNOWN
      }
    }
  }

  protected _resolveStringValue(value: unknown): string {
    if (typeof value === 'string') {
      return value
    }

    return ''
  }

  protected _sanitizeSessions(params: { rawEntries: unknown[] }): SessionInfo[] {
    const { rawEntries } = params

    return rawEntries
      .map((rawEntry) => {
        return this._resolveSessionInfo({ rawEntry })
      })
      .filter((session): session is SessionInfo => {
        return session !== undefined
      })
  }

  protected _tryParseSessionsJson(params: { stdout: string }): unknown {
    const { stdout } = params
    try {
      return JSON.parse(stdout)
    } catch {
      return this._tryParseSessionsJsonSlice({ stdout })
    }
  }

  protected _tryParseSessionsJsonSlice(params: { stdout: string }): unknown {
    const { stdout } = params
    const startIndex = stdout.indexOf('[')
    const endIndex = stdout.lastIndexOf(']')

    if (startIndex < 0 || endIndex <= startIndex) {
      throw new Error("'claude agents --json' printed output that is not valid JSON")
    }

    try {
      return JSON.parse(stdout.slice(startIndex, endIndex + 1))
    } catch {
      throw new Error("'claude agents --json' printed output that is not valid JSON")
    }
  }
}
