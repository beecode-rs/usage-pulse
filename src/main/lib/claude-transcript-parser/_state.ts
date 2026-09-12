import { type SessionTranscriptStats } from '#src/shared/business/model/session-model'

export type TranscriptParseState = {
  aiTitle: string
  cacheCreationTokens: number
  cacheReadTokens: number
  contextSizeTokens: number | undefined
  gitBranch: string
  inputTokens: number
  lastActivityAt: number | undefined
  lastPrompt: string
  model: string
  outputTokens: number
  seenMessageIds: Set<string>
  thinkingTokens: number
  userTurnsCount: number
  version: string
}

export const claudeTranscriptParserState = {
  create: (): TranscriptParseState => {
    return {
      aiTitle: '',
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      contextSizeTokens: undefined,
      gitBranch: '',
      inputTokens: 0,
      lastActivityAt: undefined,
      lastPrompt: '',
      model: '',
      outputTokens: 0,
      seenMessageIds: new Set<string>(),
      thinkingTokens: 0,
      userTurnsCount: 0,
      version: '',
    }
  },

  resolveStats: (params: { state: TranscriptParseState }): SessionTranscriptStats => {
    const { state } = params

    return {
      aiTitle: state.aiTitle,
      cacheCreationTokens: state.cacheCreationTokens,
      cacheReadTokens: state.cacheReadTokens,
      contextSizeTokens: state.contextSizeTokens,
      gitBranch: state.gitBranch,
      inputTokens: state.inputTokens,
      lastActivityAt: state.lastActivityAt,
      lastPrompt: state.lastPrompt,
      model: state.model,
      outputTokens: state.outputTokens,
      thinkingTokens: state.thinkingTokens,
      userTurnsCount: state.userTurnsCount,
      version: state.version,
    }
  },
}
