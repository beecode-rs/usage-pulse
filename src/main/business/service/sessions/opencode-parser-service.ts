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

const openCodeTabSchema = z.object({ sessionID: z.string().catch('') }).catch({ sessionID: '' })

const openCodeTabsSchema = z
  .object({
    cwd: z.record(z.string(), z.object({ tabs: z.array(openCodeTabSchema).catch([]) }).catch({ tabs: [] })).catch({}),
    global: z
      .object({ tabs: z.array(openCodeTabSchema).catch([]) })
      .catch({ tabs: [] })
      .optional(),
  })
  .catch({ cwd: {} })

const openCodeWaitingEntrySchema = z.object({ sessionID: z.string().catch('') }).catch({ sessionID: '' })

export class SessionsOpenCodeParserService {
  parseSessions(params: {
    active: unknown
    forms?: unknown[]
    nowMs: number
    openTabs?: unknown
    permissions?: unknown[]
    sessions: unknown
  }): SessionInfo[] {
    const { active, forms, nowMs, openTabs, permissions, sessions } = params
    const activeSessionIds = this._resolveActiveSessionIds({ active })
    const openTabSessionIds = this._resolveOpenTabSessionIds({ openTabs })
    const waitingSessionIds = this._resolveWaitingSessionIds({ forms, permissions })

    return this._resolveSessionEntries({ activeSessionIds, nowMs, openTabSessionIds, sessions }).map((entry) => {
      return this._buildSessionInfo({ activeSessionIds, entry, waitingSessionIds })
    })
  }

  parseRemoteEnvelope(params: { stdout: string }): {
    active: unknown
    forms: unknown[]
    openTabs: unknown
    permissions: unknown[]
    sessions: unknown
  } {
    const { stdout } = params
    const sections = stdout.split(constant.sessions.ssh.openCodeEnvelopeMarker)

    if (sections.length < 2) {
      return { active: { data: {} }, forms: [], openTabs: {}, permissions: [], sessions: { data: [] } }
    }

    return {
      active: this._recoverSectionJson({ section: sections[1] ?? '' }) ?? { data: {} },
      forms: this._recoverWaitingEntries({ section: sections[3] ?? '' }),
      openTabs: this._recoverSectionJson({ section: sections[2] ?? '' }) ?? {},
      permissions: this._recoverWaitingEntries({ section: sections[4] ?? '' }),
      sessions: this._recoverSectionJson({ section: sections[0] ?? '' }) ?? { data: [] },
    }
  }

  protected _resolveActiveSessionIds(params: { active: unknown }): Set<string> {
    const { active } = params
    const parsedActive = openCodeActiveEnvelopeSchema.parse(active)

    return new Set(Object.keys(parsedActive.data))
  }

  protected _resolveOpenTabSessionIds(params: { openTabs: unknown }): Set<string> {
    const { openTabs } = params
    const parsedTabs = openCodeTabsSchema.parse(openTabs ?? {})
    const cwdTabSessionIds = Object.values(parsedTabs.cwd).flatMap((cwdEntry) => {
      return cwdEntry.tabs.map((tab) => {
        return tab.sessionID
      })
    })
    const globalTabSessionIds = (parsedTabs.global?.tabs ?? []).map((tab) => {
      return tab.sessionID
    })

    return new Set(
      [...cwdTabSessionIds, ...globalTabSessionIds].filter((sessionId) => {
        return sessionId !== ''
      }),
    )
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
    openTabSessionIds: Set<string>
    sessions: unknown
  }): OpenCodeSessionEntry[] {
    const { activeSessionIds, nowMs, openTabSessionIds, sessions } = params
    const parsedEnvelope = openCodeSessionsEnvelopeSchema.parse(sessions)

    return parsedEnvelope.data.reduce<OpenCodeSessionEntry[]>((entries, rawEntry) => {
      return this._appendVisibleSessionEntry({ activeSessionIds, entries, nowMs, openTabSessionIds, rawEntry })
    }, [])
  }

  protected _appendVisibleSessionEntry(params: {
    activeSessionIds: Set<string>
    entries: OpenCodeSessionEntry[]
    nowMs: number
    openTabSessionIds: Set<string>
    rawEntry: unknown
  }): OpenCodeSessionEntry[] {
    const { activeSessionIds, entries, nowMs, openTabSessionIds, rawEntry } = params
    const parsedEntry = openCodeSessionEntrySchema.safeParse(rawEntry)

    if (
      !parsedEntry.success ||
      !this._isVisibleEntry({ activeSessionIds, entry: parsedEntry.data, nowMs, openTabSessionIds })
    ) {
      return entries
    }

    return [...entries, parsedEntry.data]
  }

  protected _isVisibleEntry(params: {
    activeSessionIds: Set<string>
    entry: OpenCodeSessionEntry
    nowMs: number
    openTabSessionIds: Set<string>
  }): boolean {
    const { activeSessionIds, entry, nowMs, openTabSessionIds } = params

    if (entry.parentID !== undefined || entry.time.archived !== undefined) {
      return false
    }

    if (activeSessionIds.has(entry.id)) {
      return true
    }

    if (openTabSessionIds.has(entry.id)) {
      return true
    }

    return this._isRecentlyUpdated({ entry, nowMs })
  }

  protected _isRecentlyUpdated(params: { entry: OpenCodeSessionEntry; nowMs: number }): boolean {
    const { entry, nowMs } = params
    const updated = entry.time.updated

    if (updated === undefined) {
      return false
    }

    return nowMs - updated <= constant.sessions.opencodeQuery.recentSessionWindowMs
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
