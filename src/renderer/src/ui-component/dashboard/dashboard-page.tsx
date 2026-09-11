import { type ReactElement, useEffect, useState } from 'react'

import { AppViewIdMapper } from '#src/renderer/src/business/model/app-view-id-mapper-enum'
import { sessionsClientService } from '#src/renderer/src/business/service/sessions-client-service'
import { usageClientService } from '#src/renderer/src/business/service/usage-client-service'
import { DashboardEmptyBox } from '#src/renderer/src/ui-component/dashboard/dashboard-empty-box'
import { DashboardSessionBox } from '#src/renderer/src/ui-component/dashboard/dashboard-session-box'
import { DashboardUsageBox } from '#src/renderer/src/ui-component/dashboard/dashboard-usage-box'
import '#src/renderer/src/ui-component/dashboard/dashboard.css'
import '#src/renderer/src/ui-component/sessions/sessions.css'
import '#src/renderer/src/ui-component/usage-dashboard/usage-dashboard.css'
import { errorUtil } from '#src/renderer/src/util/error-util'
import { type SessionInfo, type SessionSnapshot } from '#src/shared/business/model/session-model'
import type { UsageSnapshot } from '#src/shared/business/model/usage-model'

const resolveSessionKey = (session: SessionInfo): string => {
  const hostId = session.hostId ?? 'local'

  return `${hostId}:${session.sessionId}:${String(session.pid)}`
}

export const DashboardPage = (props: {
  finishedAtBySessionId: Record<string, number>
  onNavigate: (viewId: AppViewIdMapper.SESSIONS | AppViewIdMapper.USAGE) => void
  pulseMs: number
}): ReactElement => {
  const { finishedAtBySessionId, onNavigate, pulseMs } = props

  const [usageSnapshot, setUsageSnapshot] = useState<UsageSnapshot | undefined>(undefined)
  const [sessionSnapshot, setSessionSnapshot] = useState<SessionSnapshot | undefined>(undefined)
  const [focusErrorMessage, setFocusErrorMessage] = useState('')
  const [sessionsErrorMessage, setSessionsErrorMessage] = useState('')

  const loadUsageSnapshot = async (): Promise<void> => {
    try {
      const currentSnapshot = await usageClientService.getSnapshot()

      setUsageSnapshot(currentSnapshot)
    } catch {
      return
    }
  }

  const loadSessionsSnapshot = async (): Promise<void> => {
    try {
      const nextSnapshot = await sessionsClientService.resolveSessionsSnapshot()

      setSessionSnapshot(nextSnapshot)
      setSessionsErrorMessage('')
    } catch (error) {
      setSessionsErrorMessage(errorUtil.resolveMessage(error))
    }
  }

  const focusSession = async (params: { cwd: string; pid: number }): Promise<void> => {
    try {
      await sessionsClientService.focusSession({ cwd: params.cwd, pid: params.pid })

      setFocusErrorMessage('')
    } catch (error) {
      setFocusErrorMessage(errorUtil.resolveMessage(error))
    }
  }

  useEffect(() => {
    const unsubscribe = usageClientService.subscribeToUsageUpdates({
      onUpdate: (updatedSnapshot) => {
        setUsageSnapshot(updatedSnapshot)
      },
    })

    void loadUsageSnapshot()

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    void loadSessionsSnapshot()
  }, [])

  useEffect(() => {
    return sessionsClientService.subscribeToSessionsUpdates({
      onUpdate: (nextSnapshot) => {
        setSessionSnapshot(nextSnapshot)
      },
    })
  }, [])

  const providerSnapshots = usageSnapshot?.providers ?? []
  const sessions = sessionSnapshot?.sessions ?? []
  const isLoading = usageSnapshot === undefined && sessionSnapshot === undefined && sessionsErrorMessage === ''
  const isUsageEmpty = usageSnapshot !== undefined && providerSnapshots.length === 0
  const isSessionsEmpty = sessions.length === 0 && (sessionSnapshot !== undefined || sessionsErrorMessage !== '')

  return (
    <div className="dashboard dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Usage limits and active sessions at a glance</p>
        </div>
      </header>
      {sessionsErrorMessage !== '' && <p className="dashboard-error">{sessionsErrorMessage}</p>}
      {focusErrorMessage !== '' && <p className="dashboard-error">{focusErrorMessage}</p>}
      <main className="dashboard-grid">
        {isLoading && <p className="dashboard-empty">Loading…</p>}
        {providerSnapshots.map((providerSnapshot) => {
          return <DashboardUsageBox key={providerSnapshot.trackerId} providerSnapshot={providerSnapshot} />
        })}
        {isUsageEmpty && (
          <DashboardEmptyBox
            label="Set up a tracker to monitor plan usage"
            onOpen={() => {
              onNavigate(AppViewIdMapper.USAGE)
            }}
            title="Usage"
          />
        )}
        {sessions.map((session) => {
          return (
            <DashboardSessionBox
              finishedAtMs={finishedAtBySessionId[session.sessionId]}
              key={resolveSessionKey(session)}
              onFocus={() => {
                void focusSession({ cwd: session.cwd, pid: session.pid })
              }}
              pulseMs={pulseMs}
              session={session}
            />
          )
        })}
        {isSessionsEmpty && (
          <DashboardEmptyBox
            label="No active sessions detected"
            onOpen={() => {
              onNavigate(AppViewIdMapper.SESSIONS)
            }}
            title="Sessions"
          />
        )}
      </main>
    </div>
  )
}
