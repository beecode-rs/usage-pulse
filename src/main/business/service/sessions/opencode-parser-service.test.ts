// Supplements: ./opencode-parser-service.contract.yaml
// Covers: the field-level mapping of parseSessions that the contract yaml
// cannot express. The msh-test-contractor result matcher
// (ContractExpectAnyEqualStrategy -> objectUtil.stringifyOrNullUndefined)
// serializes results with JSON.stringify and a top-level key-filter replacer,
// so nested session objects and transcript stats collapse to opaque shapes and
// the yaml terms only assert session counts. These tests pin every mapped
// field, the transcript signal rules, the visibility filter (top-level, not
// archived, and active or recently updated) and the
// parseRemoteEnvelope -> parseSessions composition of the ssh flow.

import { describe, expect, it } from 'vitest'

import { SessionsOpenCodeParserService } from '#src/main/business/service/sessions/opencode-parser-service'
import { constant } from '#src/main/util/constant'
import { SessionProviderMapper } from '#src/shared/business/enum/session-provider-mapper-enum'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'

const liveRunningEntry = {
  id: 'ses_e96acc339ffegA84VkCje3KC7g',
  location: { directory: '/Users/milos/code/usage-pulse' },
  model: { id: 'glm-5.3' },
  time: { created: 1792768425216, updated: 1792768596239 },
  title: 'Opencode and SSH session provider support',
  tokens: { cache: { read: 532352, write: 0 }, input: 45483, output: 1454, reasoning: 3865 },
}

const expectedLiveRunningSession: SessionInfo = {
  cwd: '/Users/milos/code/usage-pulse',
  kind: '',
  name: 'Opencode and SSH session provider support',
  provider: SessionProviderMapper.OPENCODE,
  sessionId: 'ses_e96acc339ffegA84VkCje3KC7g',
  startedAt: 1792768425216,
  status: SessionStatusMapper.BUSY,
  transcript: {
    aiTitle: '',
    cacheCreationTokens: 0,
    cacheReadTokens: 532352,
    gitBranch: '',
    inputTokens: 45483,
    lastActivityAt: 1792768596239,
    lastPrompt: '',
    model: 'glm-5.3',
    outputTokens: 1454,
    thinkingTokens: 3865,
    userTurnsCount: 0,
    version: '',
  },
}

const nowMs = liveRunningEntry.time.updated + 60_000
const staleNowMs = liveRunningEntry.time.updated + constant.sessions.opencodeQuery.recentSessionWindowMs + 1

const parseSessions = (params: {
  active: unknown
  forms?: unknown[]
  nowMs: number
  openTabs?: unknown
  permissions?: unknown[]
  sessions: unknown
}): SessionInfo[] => {
  return new SessionsOpenCodeParserService().parseSessions(params)
}

describe('SessionsOpenCodeParserService [contract supplement]', () => {
  it('maps a recently updated running session with the full transcript stats and no pid', () => {
    const sessions = parseSessions({
      active: { data: { ses_e96acc339ffegA84VkCje3KC7g: { type: 'running' } } },
      nowMs,
      sessions: { data: [liveRunningEntry] },
    })

    expect(sessions).toEqual([expectedLiveRunningSession])
    expect(Object.hasOwn(sessions[0] as object, 'pid')).toBe(false)
    expect(Object.hasOwn(sessions[0] as object, 'hostId')).toBe(false)
  })

  it('maps a recently updated session to idle when it is absent from the active envelope', () => {
    const sessions = parseSessions({
      active: { data: { ses_other: { type: 'running' } } },
      nowMs,
      sessions: { data: [liveRunningEntry] },
    })

    expect(sessions).toEqual([{ ...expectedLiveRunningSession, status: SessionStatusMapper.IDLE }])
  })

  it('keeps a stale session visible while it is actively running', () => {
    const sessions = parseSessions({
      active: { data: { ses_e96acc339ffegA84VkCje3KC7g: { type: 'running' } } },
      nowMs: staleNowMs,
      sessions: { data: [liveRunningEntry] },
    })

    expect(sessions).toEqual([expectedLiveRunningSession])
  })

  it('drops a stale idle session that left the recent window', () => {
    const sessions = parseSessions({
      active: { data: {} },
      nowMs: staleNowMs,
      sessions: { data: [liveRunningEntry] },
    })

    expect(sessions).toEqual([])
  })

  it('keeps a session with a finished outcome while it is recent or active', () => {
    const finishedButRecentEntry = {
      ...liveRunningEntry,
      id: 'ses_done_turn',
      outcome: 'succeeded',
      time: { created: 1792768425216, updated: nowMs - 60_000 },
    }

    const sessions = parseSessions({
      active: { data: {} },
      nowMs,
      sessions: { data: [finishedButRecentEntry] },
    })

    expect(sessions).toEqual([
      { ...expectedLiveRunningSession, sessionId: 'ses_done_turn', status: SessionStatusMapper.IDLE },
    ])
  })

  it('omits the transcript when the session has no model or token signal', () => {
    const sessions = parseSessions({
      active: { data: {} },
      nowMs,
      sessions: {
        data: [
          {
            id: 'ses_idle',
            location: { directory: '/tmp/other' },
            model: { id: '' },
            time: { created: nowMs - 120_000, updated: nowMs - 60_000 },
            title: '',
            tokens: { cache: { read: 0, write: 0 }, input: 0, output: 0, reasoning: 0 },
          },
        ],
      },
    })

    expect(sessions).toEqual([
      {
        cwd: '/tmp/other',
        kind: '',
        name: '',
        provider: SessionProviderMapper.OPENCODE,
        sessionId: 'ses_idle',
        startedAt: nowMs - 120_000,
        status: SessionStatusMapper.IDLE,
      },
    ])
    expect(Object.hasOwn(sessions[0] as object, 'transcript')).toBe(false)
  })

  it('defaults missing location, model, tokens and title fields', () => {
    const sessions = parseSessions({
      active: { data: { ses_minimal: { type: 'running' } } },
      nowMs: staleNowMs,
      sessions: { data: [{ id: 'ses_minimal', time: { created: 5 } }] },
    })

    expect(sessions).toEqual([
      {
        cwd: '',
        kind: '',
        name: '',
        provider: SessionProviderMapper.OPENCODE,
        sessionId: 'ses_minimal',
        startedAt: 5,
        status: SessionStatusMapper.BUSY,
      },
    ])
    expect(Object.hasOwn(sessions[0] as object, 'transcript')).toBe(false)
  })

  it('drops stale, archived and invalid sessions while keeping visible siblings', () => {
    const sessions = parseSessions({
      active: { data: { ses_e96acc339ffegA84VkCje3KC7g: { type: 'running' } } },
      nowMs: staleNowMs,
      sessions: {
        data: [
          liveRunningEntry,
          { ...liveRunningEntry, id: 'ses_stale', time: { created: 1792760000000, updated: 1792760000000 } },
          { ...liveRunningEntry, id: 'ses_archived', time: { archived: 1792769999999, created: 1, updated: 2 } },
          // an invalid archived stamp fails the time schema and drops the entry
          { ...liveRunningEntry, id: 'ses_bad_archived', time: { archived: null, created: 1 } },
          42,
          { ...liveRunningEntry, id: 4242 },
          { ...liveRunningEntry, id: 'ses_bad_created', time: { created: '3' } },
        ],
      },
    })

    expect(sessions).toEqual([expectedLiveRunningSession])
  })

  it('drops subagent child sessions (parentID set) while the top-level sibling survives', () => {
    const sessions = parseSessions({
      active: { data: { ses_e96acc339ffegA84VkCje3KC7g: { type: 'running' } } },
      nowMs: staleNowMs,
      sessions: {
        data: [
          liveRunningEntry,
          { ...liveRunningEntry, id: 'ses_subagent', parentID: 'ses_e96acc339ffegA84VkCje3KC7g' },
        ],
      },
    })

    expect(sessions).toEqual([expectedLiveRunningSession])
  })

  it('builds a transcript from token signal alone with an empty model', () => {
    const sessions = parseSessions({
      active: { data: {} },
      nowMs,
      sessions: {
        data: [
          {
            id: 'ses_tokens_only',
            model: { id: '' },
            time: { created: nowMs - 120_000, updated: nowMs - 60_000 },
            tokens: { cache: { read: 0, write: 0 }, input: 5, output: 0, reasoning: 0 },
          },
        ],
      },
    })

    expect(sessions[0]?.transcript).toEqual({
      aiTitle: '',
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      gitBranch: '',
      inputTokens: 5,
      lastActivityAt: nowMs - 60_000,
      lastPrompt: '',
      model: '',
      outputTokens: 0,
      thinkingTokens: 0,
      userTurnsCount: 0,
      version: '',
    })
  })

  it('builds a transcript from model signal alone with zero tokens', () => {
    const sessions = parseSessions({
      active: { data: {} },
      nowMs,
      sessions: {
        data: [
          {
            id: 'ses_model_only',
            model: { id: 'glm-5.3' },
            time: { created: nowMs - 120_000, updated: nowMs - 60_000 },
            tokens: { cache: { read: 0, write: 0 }, input: 0, output: 0, reasoning: 0 },
          },
        ],
      },
    })

    expect(sessions[0]?.transcript).toEqual({
      aiTitle: '',
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      gitBranch: '',
      inputTokens: 0,
      lastActivityAt: nowMs - 60_000,
      lastPrompt: '',
      model: 'glm-5.3',
      outputTokens: 0,
      thinkingTokens: 0,
      userTurnsCount: 0,
      version: '',
    })
  })

  it('defaults a missing cache block to zero cache tokens', () => {
    const sessions = parseSessions({
      active: { data: {} },
      nowMs,
      sessions: {
        data: [
          {
            id: 'ses_no_cache',
            model: { id: 'glm-5.3' },
            time: { created: nowMs - 120_000, updated: nowMs - 60_000 },
            tokens: { input: 5 },
          },
        ],
      },
    })

    expect(sessions[0]?.transcript?.cacheCreationTokens).toBe(0)
    expect(sessions[0]?.transcript?.cacheReadTokens).toBe(0)
    expect(sessions[0]?.transcript?.inputTokens).toBe(5)
  })

  it('drops lastActivityAt when time.updated is present but invalid', () => {
    const sessions = parseSessions({
      active: { data: { ses_bad_updated: { type: 'running' } } },
      nowMs,
      sessions: {
        data: [{ id: 'ses_bad_updated', model: { id: 'glm-5.3' }, time: { created: 1, updated: 'oops' } }],
      },
    })

    expect(sessions[0]?.transcript).toBeDefined()
    expect(sessions[0]?.transcript?.lastActivityAt).toBeUndefined()
  })

  it('keeps a stale idle session visible while its tab is open in a tui', () => {
    const sessions = parseSessions({
      active: { data: {} },
      nowMs: staleNowMs,
      openTabs: {
        cwd: {
          '/Users/milos/Nextcloud/box/ai/opencode': {
            tabs: [{ sessionID: liveRunningEntry.id, title: 'Opencode and SSH session provider support' }],
          },
        },
        global: { tabs: [], unread: {} },
      },
      sessions: { data: [liveRunningEntry] },
    })

    expect(sessions).toEqual([{ ...expectedLiveRunningSession, status: SessionStatusMapper.IDLE }])
  })

  it('marks a session waiting when a question form is pending for it', () => {
    const sessions = parseSessions({
      active: { data: { ses_e96acc339ffegA84VkCje3KC7g: { type: 'running' } } },
      forms: [
        {
          metadata: { kind: 'question' },
          sessionID: liveRunningEntry.id,
          title: 'Questions',
        },
      ],
      nowMs,
      sessions: { data: [liveRunningEntry] },
    })

    expect(sessions).toEqual([{ ...expectedLiveRunningSession, status: SessionStatusMapper.WAITING }])
  })

  it('marks a session waiting when it has a pending permission request', () => {
    const sessions = parseSessions({
      active: { data: {} },
      nowMs,
      openTabs: {
        cwd: { '/w': { tabs: [{ sessionID: liveRunningEntry.id, title: 't' }] } },
      },
      permissions: [{ action: 'bash', sessionID: liveRunningEntry.id }],
      sessions: { data: [liveRunningEntry] },
    })

    expect(sessions).toEqual([{ ...expectedLiveRunningSession, status: SessionStatusMapper.WAITING }])
  })

  it('resolves waiting over busy when a running session also has a pending permission request', () => {
    const sessions = parseSessions({
      active: { data: { ses_e96acc339ffegA84VkCje3KC7g: { type: 'running' } } },
      nowMs,
      permissions: [{ action: 'bash', sessionID: liveRunningEntry.id }],
      sessions: { data: [liveRunningEntry] },
    })

    expect(sessions).toEqual([{ ...expectedLiveRunningSession, status: SessionStatusMapper.WAITING }])
  })

  it('tolerates junk tabs and waiting payloads without throwing', () => {
    const sessions = parseSessions({
      active: { data: { ses_e96acc339ffegA84VkCje3KC7g: { type: 'running' } } },
      forms: [42, 'nope'],
      nowMs: staleNowMs,
      openTabs: 42,
      permissions: [{ sessionID: 7 }],
      sessions: { data: [liveRunningEntry] },
    })

    expect(sessions).toEqual([expectedLiveRunningSession])
  })

  it('feeds the remote envelope through parseSessions end to end', () => {
    const parser = new SessionsOpenCodeParserService()
    const staleEntry = {
      ...liveRunningEntry,
      id: 'ses_stale',
      time: { created: 1792760000000, updated: 1792760000000 },
    }
    const openTabEntry = {
      ...liveRunningEntry,
      id: 'ses_open_tab',
      time: { created: 1792760000001, updated: 1792760000001 },
      title: 'Old but open in a tui tab',
    }
    const quizEntry = {
      ...liveRunningEntry,
      id: 'ses_quiz',
      time: { created: 1792760000002, updated: 1792760000002 },
      title: 'Quiz question',
    }
    const stdout = [
      `{"data":[${JSON.stringify(liveRunningEntry)},${JSON.stringify(staleEntry)},${JSON.stringify(openTabEntry)},${JSON.stringify(quizEntry)}]}`,
      constant.sessions.ssh.openCodeEnvelopeMarker,
      `{"data":{"${liveRunningEntry.id}":{"type":"running"},"ses_quiz":{"type":"running"}}}`,
      constant.sessions.ssh.openCodeEnvelopeMarker,
      '{"cwd":{"/w":{"tabs":[{"sessionID":"ses_open_tab","title":"Old but open in a tui tab"}]}}}',
      constant.sessions.ssh.openCodeEnvelopeMarker,
      `[{"data":[]},{"data":[{"metadata":{"kind":"question"},"sessionID":"ses_quiz","title":"Questions"}]}]`,
      constant.sessions.ssh.openCodeEnvelopeMarker,
      '[]',
    ].join('\n')

    const envelope = parser.parseRemoteEnvelope({ stdout })
    const sessions = parser.parseSessions({ ...envelope, nowMs: staleNowMs })

    expect(sessions).toEqual([
      expectedLiveRunningSession,
      {
        ...expectedLiveRunningSession,
        name: 'Old but open in a tui tab',
        sessionId: 'ses_open_tab',
        startedAt: 1792760000001,
        status: SessionStatusMapper.IDLE,
        transcript: { ...expectedLiveRunningSession.transcript, lastActivityAt: 1792760000001 },
      },
      {
        ...expectedLiveRunningSession,
        name: 'Quiz question',
        sessionId: 'ses_quiz',
        startedAt: 1792760000002,
        status: SessionStatusMapper.WAITING,
        transcript: { ...expectedLiveRunningSession.transcript, lastActivityAt: 1792760000002 },
      },
    ])
  })

  it('parses the stopped-service envelope to no sessions', () => {
    const parser = new SessionsOpenCodeParserService()
    const stdout = [
      '{"data":[]}',
      constant.sessions.ssh.openCodeEnvelopeMarker,
      '{"data":{}}',
      constant.sessions.ssh.openCodeEnvelopeMarker,
      '{}',
      constant.sessions.ssh.openCodeEnvelopeMarker,
      '[]',
      constant.sessions.ssh.openCodeEnvelopeMarker,
      '[]',
    ].join('\n')
    const envelope = parser.parseRemoteEnvelope({ stdout })
    const sessions = parser.parseSessions({ ...envelope, nowMs })

    expect(sessions).toEqual([])
  })
})
