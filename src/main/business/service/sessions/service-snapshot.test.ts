// Supplements: the local merge seams of _SessionsService._fetchSnapshot that
// the per-service contract yamls cannot reach through the harness hooks:
// - the claude + opencode merge behind listSessions, sorted with the
//   claude-code group before the opencode group by the provider tiebreak
// - the safe deterministic default of the openCodeSessions hook: with no stub
//   set the snapshot resolves with claude sessions only, never falling through
//   to the real SessionsOpenCodeQueryService and the developer's live daemon
// - the claude query failure still rejecting the snapshot even when opencode
//   has sessions (claude error wins, opencode is best-effort)

import { describe, expect, it } from 'vitest'

import { SessionsServiceContractHarness } from '#src/main/business/service/sessions/__tests__/_service-singleton-contract-harness'
import { SessionProviderMapper } from '#src/shared/business/enum/session-provider-mapper-enum'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'

const claudeAgentsStdout = JSON.stringify([
  {
    cwd: '/w',
    kind: 'main',
    name: 'claude-zeta',
    pid: 4242,
    sessionId: 'cc-zeta',
    startedAt: 2,
    status: SessionStatusMapper.BUSY,
  },
  {
    cwd: '/w',
    kind: 'main',
    name: 'claude-alpha',
    pid: 4243,
    sessionId: 'cc-alpha',
    startedAt: 1,
    status: SessionStatusMapper.IDLE,
  },
])

const openCodeSession = (params: { name: string; sessionId: string }): SessionInfo => {
  return {
    cwd: '/w',
    kind: '',
    name: params.name,
    provider: SessionProviderMapper.OPENCODE,
    sessionId: params.sessionId,
    startedAt: 3,
    status: SessionStatusMapper.IDLE,
  }
}

const resolveSessionIds = (sessions: SessionInfo[]): string[] => {
  return sessions.map((session) => {
    return session.sessionId
  })
}

describe('SessionsService local snapshot merge [contract supplement]', () => {
  it('merges claude and opencode sessions sorted by provider then name', async () => {
    const service = new SessionsServiceContractHarness()
    service.macOsAgentsQueryStdout = claudeAgentsStdout
    service.openCodeSessions = [openCodeSession({ name: 'opencode-beta', sessionId: 'op-beta' })]

    const snapshot = await service.listSessions()

    expect(snapshot.errorMessage).toBeUndefined()
    expect(resolveSessionIds(snapshot.sessions)).toEqual(['cc-alpha', 'cc-zeta', 'op-beta'])
    expect(snapshot.sessions.map((session) => session.provider)).toEqual([
      SessionProviderMapper.CLAUDE_CODE,
      SessionProviderMapper.CLAUDE_CODE,
      SessionProviderMapper.OPENCODE,
    ])
  })

  it('resolves with claude sessions only when no opencode stub is set', async () => {
    const service = new SessionsServiceContractHarness()
    service.macOsAgentsQueryStdout = claudeAgentsStdout

    const snapshot = await service.listSessions()

    expect(resolveSessionIds(snapshot.sessions)).toEqual(['cc-alpha', 'cc-zeta'])
  })

  it('rejects with the claude parser error even when opencode has sessions', async () => {
    const service = new SessionsServiceContractHarness()
    service.macOsAgentsQueryStdout = 'not json'
    service.openCodeSessions = [openCodeSession({ name: 'opencode-beta', sessionId: 'op-beta' })]

    await expect(service.listSessions()).rejects.toThrow("'claude agents --json' printed output that is not valid JSON")
  })
})
