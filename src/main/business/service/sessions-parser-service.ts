import { z } from 'zod'

import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'

const SESSION_ORIGIN_ORDER = {
  local: 0,
  ssh: 1,
}

const sessionEntrySchema = z.object({
  cwd: z.string().catch(''),
  kind: z.string().catch(''),
  name: z.string().catch(''),
  pid: z.number(),
  sessionId: z.string(),
  startedAt: z.number(),
  status: z.enum(SessionStatusMapper).catch(SessionStatusMapper.UNKNOWN),
})

const sessionEntriesSchema = z.array(z.unknown()).transform((rawEntries) => {
  return rawEntries.reduce<SessionInfo[]>((sessions, rawEntry) => {
    const parsedSession = sessionEntrySchema.safeParse(rawEntry)

    if (parsedSession.success) {
      return [...sessions, parsedSession.data]
    }

    return sessions
  }, [])
})

export class SessionsParserService {
  parseSessionEntries(params: { stdout: string }): SessionInfo[] {
    const { stdout } = params
    const parsed = this._tryParseSessionsJson({ stdout })
    const parsedSessions = sessionEntriesSchema.safeParse(parsed)

    if (!parsedSessions.success) {
      throw new Error("'claude agents --json' printed unexpected output: expected a JSON array of sessions")
    }

    return parsedSessions.data
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

  protected _resolveSessionOriginOrder(session: SessionInfo): number {
    if (session.hostId === undefined) {
      return SESSION_ORIGIN_ORDER.local
    }

    return SESSION_ORIGIN_ORDER.ssh
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
