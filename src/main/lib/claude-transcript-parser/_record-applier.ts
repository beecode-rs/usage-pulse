import { type ITranscriptParseState } from '#src/main/lib/claude-transcript-parser/_state'
import { objectUtil } from '#src/main/util/object-util'

export const claudeTranscriptParserRecordApplier = {
  _applyAssistantRecord: (params: { record: Record<string, unknown>; state: ITranscriptParseState }): void => {
    const message = objectUtil.asRecord(params.record['message'])

    if (message === undefined) {
      return
    }

    const messageId = claudeTranscriptParserRecordApplier._resolveNonEmptyString(message['id'])

    if (messageId !== '') {
      if (params.state.seenMessageIds.has(messageId)) {
        return
      }

      params.state.seenMessageIds.add(messageId)
    }

    claudeTranscriptParserRecordApplier._applyAssistantUsage({ message, state: params.state })

    const model = claudeTranscriptParserRecordApplier._resolveNonEmptyString(message['model'])

    if (model !== '') {
      params.state.model = model
    }
  },

  _applyAssistantUsage: (params: { message: Record<string, unknown>; state: ITranscriptParseState }): void => {
    const usage = objectUtil.asRecord(params.message['usage'])

    if (usage === undefined) {
      return
    }

    const cacheCreationTokens = claudeTranscriptParserRecordApplier._resolveFiniteNumber(
      usage['cache_creation_input_tokens'],
    )
    const cacheReadTokens = claudeTranscriptParserRecordApplier._resolveFiniteNumber(usage['cache_read_input_tokens'])
    const inputTokens = claudeTranscriptParserRecordApplier._resolveFiniteNumber(usage['input_tokens'])
    const outputTokens = claudeTranscriptParserRecordApplier._resolveFiniteNumber(usage['output_tokens'])

    params.state.cacheCreationTokens = params.state.cacheCreationTokens + cacheCreationTokens
    params.state.cacheReadTokens = params.state.cacheReadTokens + cacheReadTokens
    params.state.inputTokens = params.state.inputTokens + inputTokens
    params.state.outputTokens = params.state.outputTokens + outputTokens
    params.state.contextSizeTokens = inputTokens + cacheReadTokens + cacheCreationTokens

    const outputTokenDetails = objectUtil.asRecord(usage['output_tokens_details'])

    if (outputTokenDetails === undefined) {
      return
    }

    const thinkingTokens = claudeTranscriptParserRecordApplier._resolveFiniteNumber(
      outputTokenDetails['thinking_tokens'],
    )

    params.state.thinkingTokens = params.state.thinkingTokens + thinkingTokens
  },

  _applyByType: (params: { record: Record<string, unknown>; state: ITranscriptParseState }): void => {
    switch (params.record['type']) {
      case 'ai-title': {
        const aiTitle = claudeTranscriptParserRecordApplier._resolveNonEmptyString(params.record['aiTitle'])

        if (aiTitle !== '') {
          params.state.aiTitle = aiTitle
        }

        return
      }

      case 'assistant': {
        claudeTranscriptParserRecordApplier._applyAssistantRecord({ record: params.record, state: params.state })

        return
      }

      case 'last-prompt': {
        const lastPrompt = claudeTranscriptParserRecordApplier._resolveNonEmptyString(params.record['lastPrompt'])

        if (lastPrompt !== '') {
          params.state.lastPrompt = lastPrompt
        }

        return
      }

      case 'user': {
        if (params.record['isMeta'] !== true) {
          params.state.userTurnsCount = params.state.userTurnsCount + 1
        }

        return
      }

      default: {
        return
      }
    }
  },

  _applySharedEntryFields: (params: { record: Record<string, unknown>; state: ITranscriptParseState }): void => {
    if (params.state.gitBranch === '') {
      params.state.gitBranch = claudeTranscriptParserRecordApplier._resolveNonEmptyString(params.record['gitBranch'])
    }

    if (params.state.version === '') {
      params.state.version = claudeTranscriptParserRecordApplier._resolveNonEmptyString(params.record['version'])
    }

    const timestamp = params.record['timestamp']

    if (typeof timestamp !== 'string') {
      return
    }

    const timestampMs = Date.parse(timestamp)

    if (!Number.isNaN(timestampMs)) {
      params.state.lastActivityAt = timestampMs
    }
  },

  _resolveFiniteNumber: (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    return 0
  },

  _resolveNonEmptyString: (value: unknown): string => {
    if (typeof value === 'string' && value !== '') {
      return value
    }

    return ''
  },

  applyEntry: (params: { record: Record<string, unknown>; state: ITranscriptParseState }): void => {
    claudeTranscriptParserRecordApplier._applyByType({ record: params.record, state: params.state })
    claudeTranscriptParserRecordApplier._applySharedEntryFields({ record: params.record, state: params.state })
  },
}
