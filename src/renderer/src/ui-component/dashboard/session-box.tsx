import { type ReactElement, useEffect, useState } from 'react'

import { sessionPresentationService } from '#src/renderer/src/business/service/session-presentation-service'
import { SessionsProviderIcon } from '#src/renderer/src/ui-component/sessions/provider-icon'
import { SessionsSessionFinishedPulse } from '#src/renderer/src/ui-component/sessions/session-finished-pulse'
import { SessionsSessionFocusButton } from '#src/renderer/src/ui-component/sessions/session-focus-button'
import { SessionsSessionOriginIcon } from '#src/renderer/src/ui-component/sessions/session-origin-icon'
import { SessionsSessionTranscriptChips } from '#src/renderer/src/ui-component/sessions/session-transcript-chips'
import { SessionsSessionWaitingPulse } from '#src/renderer/src/ui-component/sessions/session-waiting-pulse'
import { constant } from '#src/renderer/src/util/constant'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'

const resolveBoxClassName = (params: { isRemote: boolean; status: SessionStatusMapper }): string => {
  const { isRemote, status } = params
  const classNames = ['dashboard-session-box', `is-${status}`]

  if (isRemote) {
    classNames.push('is-remote')
  }

  return classNames.join(' ')
}

export const DashboardSessionBox = (props: {
  finishedAtMs?: number
  onFocus: () => void
  pulseMs: number
  session: SessionInfo
}): ReactElement => {
  const { finishedAtMs, onFocus, pulseMs, session } = props
  const [nowMs, setNowMs] = useState((): number => {
    return Date.now()
  })

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowMs(Date.now())
    }, constant.ui.nowTickIntervalMs)

    return () => {
      clearInterval(intervalId)
    }
  }, [])

  const sessionTitle = sessionPresentationService.resolveSessionTitle({ session })
  const sessionTitleParts = sessionPresentationService.resolveSessionTitleParts({ title: sessionTitle })
  const statusPresentation = sessionPresentationService.resolveStatusPresentation({ status: session.status })

  return (
    <article
      className={resolveBoxClassName({ isRemote: session.hostId !== undefined, status: session.status })}
      title={session.cwd}
    >
      <SessionsSessionFinishedPulse finishedAtMs={finishedAtMs} nowMs={nowMs} pulseMs={pulseMs} />
      <SessionsSessionWaitingPulse isWaiting={session.status === SessionStatusMapper.WAITING} />
      <header className="dashboard-session-box-header">
        <div className="dashboard-session-box-heading">
          <span className="dashboard-session-box-origin">
            <SessionsSessionOriginIcon isRemote={session.hostId !== undefined} />
          </span>
          <span className="session-card-meta session-provider-chip">
            <SessionsProviderIcon provider={session.provider} size={14} />
            {sessionPresentationService.resolveProviderLabel({ provider: session.provider })}
          </span>
          {session.hostId !== undefined && session.hostLabel !== undefined && (
            <span className="dashboard-session-box-host" title={session.hostLabel}>
              {session.hostLabel}
            </span>
          )}
        </div>
        <div className="dashboard-session-box-header-actions">
          <span className={statusPresentation.badgeClassName}>
            <span className={statusPresentation.dotClassName} />
            {statusPresentation.label}
          </span>
          {session.hostId === undefined && session.pid !== undefined && (
            <SessionsSessionFocusButton label={`Focus terminal for ${sessionTitle}`} onClick={onFocus} />
          )}
        </div>
      </header>
      <h2 className="dashboard-session-box-title">
        {sessionTitleParts.name}
        {sessionTitleParts.suffix !== undefined && (
          <span className="dashboard-session-box-title-suffix"> ({sessionTitleParts.suffix})</span>
        )}
      </h2>
      {session.transcript !== undefined && (
        <SessionsSessionTranscriptChips nowMs={nowMs} transcript={session.transcript} />
      )}
    </article>
  )
}
