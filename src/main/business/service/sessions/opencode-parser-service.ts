import { z } from 'zod'

import { constant } from '#src/main/util/constant'
import { SessionProviderMapper } from '#src/shared/business/enum/session-provider-mapper-enum'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { type SessionInfo, type SessionTranscriptStats } from '#src/shared/business/model/session-model'

const openCodeSessionEntrySchema = z.object({
  id: z.string(),
  location: z.object({ directory: z.string().catch('') }).catch({ directory: '' }),
  model: z.object({ id: z.string().catch('') }).catch({ id: '' }),
  parentID: z.string().optional(),
  time: z.object({
    archived: z.number().optional(),
    created: z.number(),
    updated: z.number().optional().catch(undefined),
  }),
  title: z.string().catch(''),
  tokens: z
    .object({
      cache: z.object({ read: z.number().catch(0), write: z.number().catch(0) }).catch({ read: 0, write: 0 }),
      input: z.number().catch(0),
      output: z.number().catch(0),
      reasoning: z.number().catch(0),
    })
    .catch({ cache: { read: 0, write: 0 }, input: 0, output: 0, reasoning: 0 }),
})

type OpenCodeSessionEntry = z.infer<typeof openCodeSessionEntrySchema>

const openCodeSessionsEnvelopeSchema = z.object({ data: z.array(z.unknown()).catch([]) }).catch({ data: [] })

const openCodeActiveEnvelopeSchema = z.object({ data: z.record(z.string(), z.unknown()).catch({}) }).catch({ data: {} })

const openCodeWaitingEntrySchema = z.object({ sessionID: z.string().catch('') }).catch({ sessionID: '' })

export class SessionsOpenCodeParserService {
  parseSessions(params: {
    active: unknown
    forms?: unknown[]
    nowMs: number
    permissions?: unknown[]
    sessions: unknown
    tuiDirectories?: string[]
  }): SessionInfo[] {
    const { active, forms, nowMs, permissions, sessions } = params
    const tuiDirectories = params.tuiDirectories ?? []
    const activeSessionIds = this._resolveActiveSessionIds({ active })
    const waitingSessionIds = this._resolveWaitingSessionIds({ forms, permissions })

    return this._resolveSessionEntries({ activeSessionIds, nowMs, sessions, tuiDirectories }).map((entry) => {
      return this._buildSessionInfo({ activeSessionIds, entry, waitingSessionIds })
    })
  }

  parseRemoteEnvelope(params: { stdout: string }): {
    active: unknown
    forms: unknown[]
    permissions: unknown[]
    sessions: unknown
    tuiDirectories: string[]
  } {
    const { stdout } = params
    const sections = stdout.split(constant.sessions.ssh.openCodeEnvelopeMarker)

    if (sections.length < 2) {
      return { active: { data: {} }, forms: [], permissions: [], sessions: { data: [] }, tuiDirectories: [] }
    }

    return {
      active: this._recoverSectionJson({ section: sections[1] ?? '' }) ?? { data: {} },
      forms: this._recoverWaitingEntries({ section: sections[2] ?? '' }),
      permissions: this._recoverWaitingEntries({ section: sections[3] ?? '' }),
      sessions: this._recoverSectionJson({ section: sections[0] ?? '' }) ?? { data: [] },
      tuiDirectories: this._resolveTuiDirectories({ section: sections[4] ?? '' }),
    }
  }

  protected _resolveActiveSessionIds(params: { active: unknown }): Set<string> {
    const { active } = params
    const parsedActive = openCodeActiveEnvelopeSchema.parse(active)

    return new Set(Object.keys(parsedActive.data))
  }

  protected _resolveTuiDirectories(params: { section: string }): string[] {
    const { section } = params

    return section
      .split('\n')
      .map((line) => {
        return line.trim()
      })
      .filter((line) => {
        return line.startsWith('/')
      })
  }

  protected _resolveWaitingSessionIds(params: { forms?: unknown[]; permissions?: unknown[] }): Set<string> {
    const { forms, permissions } = params
    const waitingEntries = [...(forms ?? []), ...(permissions ?? [])]

    return new Set(
      waitingEntries
        .map((entry) => {
          return openCodeWaitingEntrySchema.parse(entry).sessionID
        })
        .filter((sessionId) => {
          return sessionId !== ''
        }),
    )
  }

  protected _resolveSessionEntries(params: {
    activeSessionIds: Set<string>
    nowMs: number
    sessions: unknown
    tuiDirectories: string[]
  }): OpenCodeSessionEntry[] {
    const { activeSessionIds, nowMs, sessions, tuiDirectories } = params
    const parsedEnvelope = openCodeSessionsEnvelopeSchema.parse(sessions)

    return parsedEnvelope.data.reduce<OpenCodeSessionEntry[]>((entries, rawEntry) => {
      return this._appendVisibleSessionEntry({ activeSessionIds, entries, nowMs, rawEntry, tuiDirectories })
    }, [])
  }

  protected _appendVisibleSessionEntry(params: {
    activeSessionIds: Set<string>
    entries: OpenCodeSessionEntry[]
    nowMs: number
    rawEntry: unknown
    tuiDirectories: string[]
  }): OpenCodeSessionEntry[] {
    const { activeSessionIds, entries, nowMs, rawEntry, tuiDirectories } = params
    const parsedEntry = openCodeSessionEntrySchema.safeParse(rawEntry)

    if (
      !parsedEntry.success ||
      !this._isVisibleEntry({ activeSessionIds, entry: parsedEntry.data, nowMs, tuiDirectories })
    ) {
      return entries
    }

    return [...entries, parsedEntry.data]
  }

  protected _isVisibleEntry(params: {
    activeSessionIds: Set<string>
    entry: OpenCodeSessionEntry
    nowMs: number
    tuiDirectories: string[]
  }): boolean {
    const { activeSessionIds, entry, nowMs, tuiDirectories } = params

    if (entry.parentID !== undefined || entry.time.archived !== undefined) {
      return false
    }

    if (activeSessionIds.has(entry.id)) {
      return true
    }

    return this._isRecentlyUsedInTuiDirectory({ entry, nowMs, tuiDirectories })
  }

  protected _isRecentlyUsedInTuiDirectory(params: {
    entry: OpenCodeSessionEntry
    nowMs: number
    tuiDirectories: string[]
  }): boolean {
    const { entry, nowMs, tuiDirectories } = params
    const updated = entry.time.updated

    if (updated === undefined) {
      return false
    }

    if (nowMs - updated > constant.sessions.opencodeQuery.recentSessionWindowMs) {
      return false
    }

    if (tuiDirectories.length === 0) {
      return true
    }

    return tuiDirectories.some((tuiDirectory) => {
      return this._isDirectoryInside({ directory: entry.location.directory, tuiDirectory })
    })
  }

  protected _isDirectoryInside(params: { directory: string; tuiDirectory: string }): boolean {
    const { directory, tuiDirectory } = params

    return directory === tuiDirectory || directory.startsWith(`${tuiDirectory}/`)
  }

  protected _buildSessionInfo(params: {
    activeSessionIds: Set<string>
    entry: OpenCodeSessionEntry
    waitingSessionIds: Set<string>
  }): SessionInfo {
    const { activeSessionIds, entry, waitingSessionIds } = params
    const session: SessionInfo = {
      cwd: entry.location.directory,
      kind: '',
      name: entry.title,
      provider: SessionProviderMapper.OPENCODE,
      sessionId: entry.id,
      startedAt: entry.time.created,
      status: this._resolveSessionStatus({ activeSessionIds, sessionId: entry.id, waitingSessionIds }),
    }
    const transcript = this._resolveTranscript({ entry })

    if (transcript === undefined) {
      return session
    }

    return { ...session, transcript }
  }

  protected _resolveSessionStatus(params: {
    activeSessionIds: Set<string>
    sessionId: string
    waitingSessionIds: Set<string>
  }): SessionStatusMapper {
    const { activeSessionIds, sessionId, waitingSessionIds } = params

    if (waitingSessionIds.has(sessionId)) {
      return SessionStatusMapper.WAITING
    }

    if (activeSessionIds.has(sessionId)) {
      return SessionStatusMapper.BUSY
    }

    return SessionStatusMapper.IDLE
  }

  protected _resolveTranscript(params: { entry: OpenCodeSessionEntry }): SessionTranscriptStats | undefined {
    const { entry } = params

    if (!this._hasTranscriptSignal({ entry })) {
      return undefined
    }

    return {
      aiTitle: '',
      cacheCreationTokens: entry.tokens.cache.write,
      cacheReadTokens: entry.tokens.cache.read,
      gitBranch: '',
      inputTokens: entry.tokens.input,
      lastActivityAt: entry.time.updated,
      lastPrompt: '',
      model: entry.model.id,
      outputTokens: entry.tokens.output,
      thinkingTokens: entry.tokens.reasoning,
      userTurnsCount: 0,
      version: '',
    }
  }

  protected _hasTranscriptSignal(params: { entry: OpenCodeSessionEntry }): boolean {
    const { entry } = params

    return (
      entry.model.id !== '' ||
      entry.tokens.cache.read > 0 ||
      entry.tokens.cache.write > 0 ||
      entry.tokens.input > 0 ||
      entry.tokens.output > 0 ||
      entry.tokens.reasoning > 0
    )
  }

  protected _recoverSectionJson(params: { section: string }): unknown {
    const { section } = params
    const startIndex = section.indexOf('{')
    const endIndex = section.lastIndexOf('}')

    if (startIndex < 0 || endIndex <= startIndex) {
      return undefined
    }

    try {
      return JSON.parse(section.slice(startIndex, endIndex + 1))
    } catch {
      return undefined
    }
  }

  protected _recoverWaitingEntries(params: { section: string }): unknown[] {
    const { section } = params
    const recovered = this._recoverSectionArrayJson({ section })

    if (!Array.isArray(recovered)) {
      return []
    }

    return recovered.flatMap((envelope) => {
      const parsedEnvelope = openCodeSessionsEnvelopeSchema.safeParse(envelope)

      if (!parsedEnvelope.success) {
        return []
      }

      return parsedEnvelope.data.data
    })
  }

  protected _recoverSectionArrayJson(params: { section: string }): unknown {
    const { section } = params
    const startIndex = section.indexOf('[')
    const endIndex = section.lastIndexOf(']')

    if (startIndex < 0 || endIndex <= startIndex) {
      return undefined
    }

    try {
      return JSON.parse(section.slice(startIndex, endIndex + 1))
    } catch {
      return undefined
    }
  }
}
