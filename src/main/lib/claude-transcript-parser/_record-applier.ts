import { type TranscriptParseState } from '#src/main/lib/claude-transcript-parser/_state'
import { objectUtil } from '#src/main/util/object-util'

export class ClaudeTranscriptParserRecordApplier {
  applyEntry(params: { record: Record<string, unknown>; state: TranscriptParseState }): void {
    const { record, state } = params
    this._applyByType({ record, state })
    this._applySharedEntryFields({ record, state })
  }

  protected _applyAssistantRecord(params: { record: Record<string, unknown>; state: TranscriptParseState }): void {
    const { record, state } = params
    const message = objectUtil.asRecord(record['message'])

    if (message === undefined) {
      return
    }

    const messageId = this._resolveNonEmptyString(message['id'])

    if (messageId !== '') {
      if (state.seenMessageIds.has(messageId)) {
        return
      }

      state.seenMessageIds.add(messageId)
    }

    this._applyAssistantUsage({ message, state })

    const model = this._resolveNonEmptyString(message['model'])

    if (model !== '') {
      state.model = model
    }
  }

  protected _applyAssistantUsage(params: { message: Record<string, unknown>; state: TranscriptParseState }): void {
    const { message, state } = params
    const usage = objectUtil.asRecord(message['usage'])

    if (usage === undefined) {
      return
    }

    const cacheCreationTokens = this._resolveFiniteNumber(usage['cache_creation_input_tokens'])
    const cacheReadTokens = this._resolveFiniteNumber(usage['cache_read_input_tokens'])
    const inputTokens = this._resolveFiniteNumber(usage['input_tokens'])
    const outputTokens = this._resolveFiniteNumber(usage['output_tokens'])

    state.cacheCreationTokens = state.cacheCreationTokens + cacheCreationTokens
    state.cacheReadTokens = state.cacheReadTokens + cacheReadTokens
    state.inputTokens = state.inputTokens + inputTokens
    state.outputTokens = state.outputTokens + outputTokens
    state.contextSizeTokens = inputTokens + cacheReadTokens + cacheCreationTokens

    const outputTokenDetails = objectUtil.asRecord(usage['output_tokens_details'])

    if (outputTokenDetails === undefined) {
      return
    }

    const thinkingTokens = this._resolveFiniteNumber(outputTokenDetails['thinking_tokens'])

    state.thinkingTokens = state.thinkingTokens + thinkingTokens
  }

  protected _applyByType(params: { record: Record<string, unknown>; state: TranscriptParseState }): void {
    const { record, state } = params
    switch (record['type']) {
      case 'ai-title': {
        const aiTitle = this._resolveNonEmptyString(record['aiTitle'])

        if (aiTitle !== '') {
          state.aiTitle = aiTitle
        }

        return
      }

      case 'assistant': {
        this._applyAssistantRecord({ record, state })

        return
      }

      case 'last-prompt': {
        const lastPrompt = this._resolveNonEmptyString(record['lastPrompt'])

        if (lastPrompt !== '') {
          state.lastPrompt = lastPrompt
        }

        return
      }

      case 'user': {
        if (record['isMeta'] !== true) {
          state.userTurnsCount = state.userTurnsCount + 1
        }

        return
      }

      default: {
        return
      }
    }
  }

  protected _applySharedEntryFields(params: { record: Record<string, unknown>; state: TranscriptParseState }): void {
    const { record, state } = params
    if (state.gitBranch === '') {
      state.gitBranch = this._resolveNonEmptyString(record['gitBranch'])
    }

    if (state.version === '') {
      state.version = this._resolveNonEmptyString(record['version'])
    }

    const timestamp = record['timestamp']

    if (typeof timestamp !== 'string') {
      return
    }

    const timestampMs = Date.parse(timestamp)

    if (!Number.isNaN(timestampMs)) {
      state.lastActivityAt = timestampMs
    }
  }

  protected _resolveFiniteNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    return 0
  }

  protected _resolveNonEmptyString(value: unknown): string {
    if (typeof value === 'string' && value !== '') {
      return value
    }

    return ''
  }
}
