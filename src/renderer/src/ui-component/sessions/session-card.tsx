import { type ReactElement } from 'react'

import { ServerIcon } from '#src/renderer/src/ui-component/icon/server-icon'
import { SessionExpandButton } from '#src/renderer/src/ui-component/sessions/session-expand-button'
import { SessionFinishedPulse } from '#src/renderer/src/ui-component/sessions/session-finished-pulse'
import { SessionFocusButton } from '#src/renderer/src/ui-component/sessions/session-focus-button'
import { SessionOriginIcon } from '#src/renderer/src/ui-component/sessions/session-origin-icon'
import { SessionTranscriptChips } from '#src/renderer/src/ui-component/sessions/session-transcript-chips'
import { SessionWaitingPulse } from '#src/renderer/src/ui-component/sessions/session-waiting-pulse'
import { dateUtil } from '#src/renderer/src/util/date-util'
import { sessionPresentationUtil } from '#src/renderer/src/util/session-presentation-util'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { type SessionInfo, type SessionTranscriptStats } from '#src/shared/business/model/session-model'

const LAST_PROMPT_PREVIEW_MAX_LENGTH = 200

const resolveCardClassName = (params: { isRemote: boolean; status: SessionStatusMapper }): string => {
  const { isRemote, status } = params
  const classNames = ['session-card', `is-${status}`]

  if (isRemote) {
    classNames.push('is-remote')
  }

  return classNames.join(' ')
}

const resolveKindLabel = (kind: string): string => {
  switch (kind) {
    case 'background': {
      return 'Background'
    }

    case 'interactive': {
      return 'Interactive'
    }

    default: {
      return kind
    }
  }
}

const resolveUptimeLabel = (params: { nowMs: number; startedAt: number }): string => {
  const { nowMs, startedAt } = params

  return `up ${dateUtil.formatDuration(nowMs - startedAt)}`
}

const resolveLastPromptPreview = (lastPrompt: string): string => {
  const collapsedPrompt = lastPrompt.replace(/\s+/g, ' ').trim()

  if (collapsedPrompt.length <= LAST_PROMPT_PREVIEW_MAX_LENGTH) {
    return collapsedPrompt
  }

  return `${collapsedPrompt.slice(0, LAST_PROMPT_PREVIEW_MAX_LENGTH)}…`
}

const resolveExpandButtonLabel = (params: { isExpanded: boolean; title: string }): string => {
  const { isExpanded, title } = params
  if (isExpanded) {
    return `Collapse details for ${title}`
  }

  return `Expand details for ${title}`
}

const renderTranscriptStat = (params: { label: string; value: string; valueTitle: string }): ReactElement => {
  const { label, value, valueTitle } = params

  return (
    <div className="session-transcript-stat">
      <span className="session-transcript-stat-label">{label}</span>
      <span className="session-transcript-stat-value" title={valueTitle}>
        {value}
      </span>
    </div>
  )
}

const renderTranscriptDetails = (params: {
  session: SessionInfo
  transcript: SessionTranscriptStats
}): ReactElement => {
  const { session, transcript } = params

  return (
    <div className="session-transcript">
      <div className="session-transcript-stats">
        {transcript.contextSizeTokens !== undefined &&
          renderTranscriptStat({
            label: 'Context',
            value: sessionPresentationUtil.resolveTokenCountLabel({ count: transcript.contextSizeTokens }),
            valueTitle: String(transcript.contextSizeTokens),
          })}
        {renderTranscriptStat({
          label: 'Input tokens',
          value: sessionPresentationUtil.resolveTokenCountLabel({ count: transcript.inputTokens }),
          valueTitle: String(transcript.inputTokens),
        })}
        {renderTranscriptStat({
          label: 'Output tokens',
          value: sessionPresentationUtil.resolveTokenCountLabel({ count: transcript.outputTokens }),
          valueTitle: String(transcript.outputTokens),
        })}
        {renderTranscriptStat({
          label: 'Cache read tokens',
          value: sessionPresentationUtil.resolveTokenCountLabel({ count: transcript.cacheReadTokens }),
          valueTitle: String(transcript.cacheReadTokens),
        })}
        {renderTranscriptStat({
          label: 'Cache creation tokens',
          value: sessionPresentationUtil.resolveTokenCountLabel({ count: transcript.cacheCreationTokens }),
          valueTitle: String(transcript.cacheCreationTokens),
        })}
        {renderTranscriptStat({
          label: 'Thinking tokens',
          value: sessionPresentationUtil.resolveTokenCountLabel({ count: transcript.thinkingTokens }),
          valueTitle: String(transcript.thinkingTokens),
        })}
        {renderTranscriptStat({
          label: 'Turns',
          value: String(transcript.userTurnsCount),
          valueTitle: 'Non-meta user turns recorded in the transcript',
        })}
      </div>
      {transcript.lastPrompt !== '' && (
        <p className="session-transcript-prompt" title={transcript.lastPrompt}>
          {resolveLastPromptPreview(transcript.lastPrompt)}
        </p>
      )}
      <div className="session-transcript-identifiers">
        {transcript.version !== '' && <span>version {transcript.version}</span>}
        <span className="session-transcript-session-id" title={session.sessionId}>
          {session.sessionId}
        </span>
      </div>
    </div>
  )
}

export const SessionCard = (props: {
  finishedAtMs?: number
  isExpanded: boolean
  nowMs: number
  onFocus: () => void
  onToggle: () => void
  pulseMs: number
  session: SessionInfo
}): ReactElement => {
  const { finishedAtMs, isExpanded, nowMs, onFocus, onToggle, pulseMs, session } = props
  const transcript = session.transcript
  const sessionTitle = sessionPresentationUtil.resolveSessionTitle({ session })
  const sessionTitleParts = sessionPresentationUtil.resolveSessionTitleParts({ title: sessionTitle })
  const statusPresentation = sessionPresentationUtil.resolveStatusPresentation({ status: session.status })

  return (
    <article
      className={resolveCardClassName({ isRemote: session.hostId !== undefined, status: session.status })}
      title={session.cwd}
    >
      <SessionFinishedPulse finishedAtMs={finishedAtMs} nowMs={nowMs} pulseMs={pulseMs} />
      <SessionWaitingPulse isWaiting={session.status === SessionStatusMapper.WAITING} />
      <header className="session-card-header">
        <div className="session-card-heading">
          <span className="session-card-origin">
            <SessionOriginIcon isRemote={session.hostId !== undefined} />
          </span>
          <h2 className="session-card-title">
            {sessionTitleParts.name}
            {sessionTitleParts.suffix !== undefined && (
              <span className="session-card-title-suffix"> ({sessionTitleParts.suffix})</span>
            )}
          </h2>
        </div>
        <span className={statusPresentation.badgeClassName}>
          <span className={statusPresentation.dotClassName} />
          {statusPresentation.label}
        </span>
        {session.hostId === undefined && (
          <SessionFocusButton label={`Focus terminal for ${sessionTitle}`} onClick={onFocus} />
        )}
        {transcript !== undefined && (
          <SessionExpandButton
            isExpanded={isExpanded}
            label={resolveExpandButtonLabel({ isExpanded, title: sessionTitle })}
            onClick={onToggle}
          />
        )}
      </header>
      <p className="session-card-project" title={session.cwd}>
        {sessionPresentationUtil.resolveProjectLabel({ cwd: session.cwd })}
      </p>
      {transcript !== undefined && <SessionTranscriptChips nowMs={nowMs} transcript={transcript} />}
      {isExpanded && transcript !== undefined && renderTranscriptDetails({ session, transcript })}
      <footer className="session-card-footer">
        {session.hostId !== undefined && (
          <span className="session-card-meta session-host-chip">
            <ServerIcon size={12} />
            {session.hostLabel}
          </span>
        )}
        {session.kind !== '' && <span className="session-card-meta">{resolveKindLabel(session.kind)}</span>}
        <span className="session-card-meta">pid {String(session.pid)}</span>
        <span className="session-card-meta">{resolveUptimeLabel({ nowMs, startedAt: session.startedAt })}</span>
      </footer>
    </article>
  )
}
