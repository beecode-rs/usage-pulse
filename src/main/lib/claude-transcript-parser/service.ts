import { ClaudeTranscriptParserRecordApplier } from '#src/main/lib/claude-transcript-parser/_record-applier'
import { type TranscriptParseState, claudeTranscriptParserState } from '#src/main/lib/claude-transcript-parser/_state'
import { objectUtil } from '#src/main/util/object-util'
import { type SessionTranscriptStats } from '#src/shared/business/model/session-model'

export class ClaudeTranscriptParserService {
  hasSignal(params: SessionTranscriptStats): boolean {
    const hasTokenUsage =
      params.cacheCreationTokens > 0 ||
      params.cacheReadTokens > 0 ||
      params.inputTokens > 0 ||
      params.outputTokens > 0 ||
      params.thinkingTokens > 0

    if (hasTokenUsage || params.userTurnsCount > 0) {
      return true
    }

    return params.aiTitle !== '' || params.gitBranch !== '' || params.lastPrompt !== '' || params.model !== ''
  }

  parseStats(params: { content: string }): SessionTranscriptStats {
    const state = params.content.split('\n').reduce<TranscriptParseState>((state, line) => {
      return this._reduceLineToState(state, line)
    }, claudeTranscriptParserState.create())

    return claudeTranscriptParserState.resolveStats({ state })
  }

  protected _reduceLineToState(state: TranscriptParseState, line: string): TranscriptParseState {
    const trimmedLine = line.trim()

    if (trimmedLine === '') {
      return state
    }

    const record = this._tryParseEntry({ line: trimmedLine })

    if (record === undefined) {
      return state
    }

    new ClaudeTranscriptParserRecordApplier().applyEntry({ record, state })

    return state
  }

  protected _tryParseEntry(params: { line: string }): Record<string, unknown> | undefined {
    try {
      return objectUtil.asRecord(JSON.parse(params.line))
    } catch {
      return undefined
    }
  }
}
