import { ClaudeTranscriptParserRecordApplier } from '#src/main/lib/claude-transcript-parser/_record-applier'
import { type TranscriptParseState, claudeTranscriptParserState } from '#src/main/lib/claude-transcript-parser/_state'
import { objectUtil } from '#src/main/util/object-util'
import { type SessionTranscriptStats } from '#src/shared/business/model/session-model'

export class ClaudeTranscriptParserService {
  hasSignal(params: SessionTranscriptStats): boolean {
    const {
      aiTitle,
      cacheCreationTokens,
      cacheReadTokens,
      gitBranch,
      inputTokens,
      lastPrompt,
      model,
      outputTokens,
      thinkingTokens,
      userTurnsCount,
    } = params
    const hasTokenUsage =
      cacheCreationTokens > 0 || cacheReadTokens > 0 || inputTokens > 0 || outputTokens > 0 || thinkingTokens > 0

    if (hasTokenUsage || userTurnsCount > 0) {
      return true
    }

    return aiTitle !== '' || gitBranch !== '' || lastPrompt !== '' || model !== ''
  }

  parseStats(params: { content: string }): SessionTranscriptStats {
    const { content } = params
    const state = content.split('\n').reduce<TranscriptParseState>((state, line) => {
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

    return new ClaudeTranscriptParserRecordApplier().applyEntry({ record, state })
  }

  protected _tryParseEntry(params: { line: string }): Record<string, unknown> | undefined {
    const { line } = params
    try {
      return objectUtil.asRecord(JSON.parse(line))
    } catch {
      return undefined
    }
  }
}
