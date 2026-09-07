import { type ISessionTranscriptStats } from '#src/shared/session-model'

export interface ITranscriptParseState {
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
  create: (): ITranscriptParseState => {
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

  resolveStats: (params: { state: ITranscriptParseState }): ISessionTranscriptStats => {
    return {
      aiTitle: params.state.aiTitle,
      cacheCreationTokens: params.state.cacheCreationTokens,
      cacheReadTokens: params.state.cacheReadTokens,
      contextSizeTokens: params.state.contextSizeTokens,
      gitBranch: params.state.gitBranch,
      inputTokens: params.state.inputTokens,
      lastActivityAt: params.state.lastActivityAt,
      lastPrompt: params.state.lastPrompt,
      model: params.state.model,
      outputTokens: params.state.outputTokens,
      thinkingTokens: params.state.thinkingTokens,
      userTurnsCount: params.state.userTurnsCount,
      version: params.state.version,
    }
  },
}
