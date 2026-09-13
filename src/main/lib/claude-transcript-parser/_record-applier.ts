import { type TranscriptParseState } from '#src/main/lib/claude-transcript-parser/_state'
import { objectUtil } from '#src/main/util/object-util'

export class ClaudeTranscriptParserRecordApplier {
  applyEntry(params: { record: Record<string, unknown>; state: TranscriptParseState }): TranscriptParseState {
    const { record, state } = params
    const stateByType = this._applyByType({ record, state })

    return this._applySharedEntryFields({ record, state: stateByType })
  }

  protected _applyAiTitleRecord(params: {
    record: Record<string, unknown>
    state: TranscriptParseState
  }): TranscriptParseState {
    const { record, state } = params
    const aiTitle = this._resolveNonEmptyString(record['aiTitle'])

    if (aiTitle === '') {
      return state
    }

    return { ...state, aiTitle }
  }

  protected _applyAssistantRecord(params: {
    record: Record<string, unknown>
    state: TranscriptParseState
  }): TranscriptParseState {
    const { record, state } = params
    const message = objectUtil.asRecord(record['message'])

    if (message === undefined) {
      return state
    }

    const messageId = this._resolveNonEmptyString(message['id'])

    if (messageId !== '' && state.seenMessageIds.has(messageId)) {
      return state
    }

    const stateWithMessageId = this._applySeenMessageId({ messageId, state })
    const stateWithUsage = this._applyAssistantUsage({ message, state: stateWithMessageId })
    const model = this._resolveNonEmptyString(message['model'])

    if (model === '') {
      return stateWithUsage
    }

    return { ...stateWithUsage, model }
  }

  protected _applyAssistantUsage(params: {
    message: Record<string, unknown>
    state: TranscriptParseState
  }): TranscriptParseState {
    const { message, state } = params
    const usage = objectUtil.asRecord(message['usage'])

    if (usage === undefined) {
      return state
    }

    const cacheCreationTokens = this._resolveFiniteNumber(usage['cache_creation_input_tokens'])
    const cacheReadTokens = this._resolveFiniteNumber(usage['cache_read_input_tokens'])
    const inputTokens = this._resolveFiniteNumber(usage['input_tokens'])
    const outputTokens = this._resolveFiniteNumber(usage['output_tokens'])
    const stateWithTokenTotals: TranscriptParseState = {
      ...state,
      cacheCreationTokens: state.cacheCreationTokens + cacheCreationTokens,
      cacheReadTokens: state.cacheReadTokens + cacheReadTokens,
      contextSizeTokens: inputTokens + cacheReadTokens + cacheCreationTokens,
      inputTokens: state.inputTokens + inputTokens,
      outputTokens: state.outputTokens + outputTokens,
    }

    return this._applyThinkingTokens({ state: stateWithTokenTotals, usage })
  }

  protected _applyByType(params: {
    record: Record<string, unknown>
    state: TranscriptParseState
  }): TranscriptParseState {
    const { record, state } = params
    switch (record['type']) {
      case 'ai-title': {
        return this._applyAiTitleRecord({ record, state })
      }

      case 'assistant': {
        return this._applyAssistantRecord({ record, state })
      }

      case 'last-prompt': {
        return this._applyLastPromptRecord({ record, state })
      }

      case 'user': {
        return this._applyUserRecord({ record, state })
      }

      default: {
        return state
      }
    }
  }

  protected _applyLastPromptRecord(params: {
    record: Record<string, unknown>
    state: TranscriptParseState
  }): TranscriptParseState {
    const { record, state } = params
    const lastPrompt = this._resolveNonEmptyString(record['lastPrompt'])

    if (lastPrompt === '') {
      return state
    }

    return { ...state, lastPrompt }
  }

  protected _applySeenMessageId(params: { messageId: string; state: TranscriptParseState }): TranscriptParseState {
    const { messageId, state } = params
    if (messageId === '') {
      return state
    }

    return { ...state, seenMessageIds: new Set(state.seenMessageIds).add(messageId) }
  }

  protected _applySharedEntryFields(params: {
    record: Record<string, unknown>
    state: TranscriptParseState
  }): TranscriptParseState {
    const { record, state } = params

    return {
      ...state,
      gitBranch: this._resolveFirstNonEmptyString({ current: state.gitBranch, next: record['gitBranch'] }),
      lastActivityAt: this._resolveLastActivityAt({ current: state.lastActivityAt, timestamp: record['timestamp'] }),
      version: this._resolveFirstNonEmptyString({ current: state.version, next: record['version'] }),
    }
  }

  protected _applyThinkingTokens(params: {
    usage: Record<string, unknown>
    state: TranscriptParseState
  }): TranscriptParseState {
    const { usage, state } = params
    const outputTokenDetails = objectUtil.asRecord(usage['output_tokens_details'])

    if (outputTokenDetails === undefined) {
      return state
    }

    const thinkingTokens = this._resolveFiniteNumber(outputTokenDetails['thinking_tokens'])

    return { ...state, thinkingTokens: state.thinkingTokens + thinkingTokens }
  }

  protected _applyUserRecord(params: {
    record: Record<string, unknown>
    state: TranscriptParseState
  }): TranscriptParseState {
    const { record, state } = params
    if (record['isMeta'] === true) {
      return state
    }

    return { ...state, userTurnsCount: state.userTurnsCount + 1 }
  }

  protected _resolveFiniteNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    return 0
  }

  protected _resolveFirstNonEmptyString(params: { current: string; next: unknown }): string {
    const { current, next } = params
    if (current !== '') {
      return current
    }

    return this._resolveNonEmptyString(next)
  }

  protected _resolveLastActivityAt(params: { current: number | undefined; timestamp: unknown }): number | undefined {
    const { current, timestamp } = params
    if (typeof timestamp !== 'string') {
      return current
    }

    const timestampMs = Date.parse(timestamp)

    if (Number.isNaN(timestampMs)) {
      return current
    }

    return timestampMs
  }

  protected _resolveNonEmptyString(value: unknown): string {
    if (typeof value === 'string' && value !== '') {
      return value
    }

    return ''
  }
}
