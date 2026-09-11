import { type ReactElement } from 'react'

import { sessionPresentationUtil } from '#src/renderer/src/util/session-presentation-util'
import type { SessionTranscriptStats } from '#src/shared/business/model/session-model'

export const SessionTranscriptChips = (props: { nowMs: number; transcript: SessionTranscriptStats }): ReactElement => {
  const { nowMs, transcript } = props

  return (
    <div className="session-card-chips">
      {transcript.contextSizeTokens !== undefined && (
        <span className="session-chip" title={`${String(transcript.contextSizeTokens)} context tokens`}>
          ctx {sessionPresentationUtil.resolveTokenCountLabel({ count: transcript.contextSizeTokens })}
        </span>
      )}
      {transcript.model !== '' && (
        <span className="session-chip" title={transcript.model}>
          {sessionPresentationUtil.resolveModelLabel({ model: transcript.model })}
        </span>
      )}
      {transcript.gitBranch !== '' && (
        <span className="session-chip" title={transcript.gitBranch}>
          {transcript.gitBranch}
        </span>
      )}
      {transcript.lastActivityAt !== undefined && (
        <span className="session-chip" title="Time of the last transcript entry">
          {sessionPresentationUtil.resolveLastActivityLabel({
            lastActivityAt: transcript.lastActivityAt,
            nowMs,
          })}
        </span>
      )}
    </div>
  )
}
