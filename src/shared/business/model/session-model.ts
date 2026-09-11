import { type SessionFocusSupportStatusMapper } from '#src/shared/business/enum/session-focus-support-status-mapper-enum'
import { type SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'

export type SessionTranscriptStats = {
  aiTitle: string
  cacheCreationTokens: number
  cacheReadTokens: number
  contextSizeTokens?: number
  gitBranch: string
  inputTokens: number
  lastActivityAt?: number
  lastPrompt: string
  model: string
  outputTokens: number
  thinkingTokens: number
  userTurnsCount: number
  version: string
}

export type SessionInfo = {
  cwd: string
  hostId?: string
  hostLabel?: string
  kind: string
  name: string
  pid: number
  sessionId: string
  startedAt: number
  status: SessionStatusMapper
  transcript?: SessionTranscriptStats
}

export type UnreachableHost = {
  errorMessage: string
  hostId: string
  hostLabel: string
}

export type SessionFocusSupport = {
  status: SessionFocusSupportStatusMapper
}

export type SessionSnapshot = {
  errorMessage?: string
  fetchedAt: number
  sessions: SessionInfo[]
  unreachableHosts: UnreachableHost[]
}

export type SessionsUpdateListener = (snapshot: SessionSnapshot) => void
