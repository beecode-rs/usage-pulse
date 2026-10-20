import { typeUtil } from '@beecode/msh-util'
import { type ReactElement, useEffect, useState } from 'react'

import { sessionsClientService } from '#src/renderer/src/business/service/sessions-client-service'
import { usageClientService } from '#src/renderer/src/business/service/usage-client-service'
import { SessionsAutoRefreshButton } from '#src/renderer/src/ui-component/sessions/auto-refresh-button'
import { SessionsAutoRefreshStatus } from '#src/renderer/src/ui-component/sessions/auto-refresh-status'
import { SessionsFocusSupportFooter } from '#src/renderer/src/ui-component/sessions/focus-support-footer'
import { SessionsRefreshButton } from '#src/renderer/src/ui-component/sessions/refresh-button'
import { SessionsRefreshProgressBar } from '#src/renderer/src/ui-component/sessions/refresh-progress-bar'
import { SessionsSessionCard } from '#src/renderer/src/ui-component/sessions/session-card'
import { SessionsSettingsButton } from '#src/renderer/src/ui-component/sessions/settings-button'
import { SessionsSettingsDialog } from '#src/renderer/src/ui-component/sessions/settings-dialog'
import { SessionsSshHostsButton } from '#src/renderer/src/ui-component/sessions/ssh-hosts-button'
import { SessionsSshHostsDialog } from '#src/renderer/src/ui-component/sessions/ssh-hosts-dialog'
import '#src/renderer/src/ui-component/sessions/sessions.css'
import '#src/renderer/src/ui-component/usage-dashboard/usage-dashboard.css'
import { constant } from '#src/renderer/src/util/constant'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { type SessionInfo, type SessionSnapshot, type UnreachableHost } from '#src/shared/business/model/session-model'
import { SettingsModel } from '#src/shared/business/model/settings-model'
import { constant as sharedConstant } from '#src/shared/util/constant'
import { errorUtil } from '#src/shared/util/error-util'

const resolveSessionKey = (session: SessionInfo): string => {
  const hostId = session.hostId ?? 'local'

  return `${hostId}:${session.sessionId}:${String(session.pid)}`
}

const resolveUnreachableHostsLabel = (hosts: UnreachableHost[]): string => {
  const hostParts = hosts.map((host) => {
    return `${host.hostLabel} (${host.errorMessage})`
  })

  return `Unreachable SSH hosts: ${hostParts.join(' · ')}`
}

const resolveSessionsWord = (count: number): string => {
  if (count === 1) {
    return 'session'
  }

  return 'sessions'
}

const resolveRefreshProgressPercent = (params: {
  cycleStartedAtMs: number
  intervalMs: number
  nowMs: number
}): number => {
  const { cycleStartedAtMs, intervalMs, nowMs } = params
  const elapsedMs = Math.min(intervalMs, Math.max(0, nowMs - cycleStartedAtMs))

  return (elapsedMs / intervalMs) * 100
}

const resolveDisplayedErrorMessage = (params: {
  fetchErrorMessage: string
  snapshot: SessionSnapshot | undefined
}): string => {
  const { fetchErrorMessage, snapshot } = params

  if (fetchErrorMessage !== '') {
    return fetchErrorMessage
  }

  return snapshot?.errorMessage ?? ''
}

const resolveSummaryLabel = (sessions: SessionInfo[]): string => {
  const counts = sessions.reduce<{ busy: number; idle: number; unknown: number; waiting: number }>(
    (statusCounts, session) => {
      switch (session.status) {
        case SessionStatusMapper.BUSY: {
          return { ...statusCounts, busy: statusCounts.busy + 1 }
        }

        case SessionStatusMapper.IDLE: {
          return { ...statusCounts, idle: statusCounts.idle + 1 }
        }

        case SessionStatusMapper.UNKNOWN: {
          return { ...statusCounts, unknown: statusCounts.unknown + 1 }
        }

        case SessionStatusMapper.WAITING: {
          return { ...statusCounts, waiting: statusCounts.waiting + 1 }
        }

        default: {
          throw typeUtil.exhaustiveError('unsupported session status [status]', session.status)
        }
      }
    },
    { busy: 0, idle: 0, unknown: 0, waiting: 0 },
  )
  const summaryParts = [
    `${String(sessions.length)} ${resolveSessionsWord(sessions.length)}`,
    `${String(counts.busy)} working`,
    `${String(counts.waiting)} waiting`,
    `${String(counts.idle)} idle`,
  ]

  if (counts.unknown > 0) {
    summaryParts.push(`${String(counts.unknown)} unknown`)
  }

  const remoteCount = sessions.filter((session) => {
    return session.hostId !== undefined
  }).length

  if (remoteCount > 0) {
    summaryParts.push(`${String(remoteCount)} remote`)
  }

  return summaryParts.join(' · ')
}

export const SessionsPage = (props: {
  finishedAtBySessionId: Record<string, number>
  pulseMs: number
}): ReactElement => {
  const { finishedAtBySessionId, pulseMs } = props
  const [snapshot, setSnapshot] = useState<SessionSnapshot | undefined>(undefined)
  const [errorMessage, setErrorMessage] = useState('')
  const [isHostsOpen, setIsHostsOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<SettingsModel | undefined>(undefined)
  const [nowMs, setNowMs] = useState((): number => {
    return Date.now()
  })
  const [expandedSessionKeys, setExpandedSessionKeys] = useState<Set<string>>(new Set<string>())

  const loadSessions = async (): Promise<void> => {
    try {
      const nextSnapshot = await sessionsClientService.listSessions()

      setSnapshot(nextSnapshot)
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(errorUtil.resolveMessage(error))
    }
  }

  const loadSessionsSnapshot = async (): Promise<void> => {
    try {
      const nextSnapshot = await sessionsClientService.resolveSessionsSnapshot()

      setSnapshot(nextSnapshot)
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(errorUtil.resolveMessage(error))
    }
  }

  const loadSessionsSettings = async (): Promise<void> => {
    try {
      const loadedSettings = await usageClientService.getSettings()

      setSettings(loadedSettings)
    } catch (error) {
      setErrorMessage(errorUtil.resolveMessage(error))
    }
  }

  const toggleAutoRefresh = async (): Promise<void> => {
    if (settings === undefined) {
      return
    }

    try {
      const nextSettings = await usageClientService.saveSettings({
        settings: new SettingsModel({
          settings: { ...settings, isSessionsAutoRefreshPaused: !settings.isSessionsAutoRefreshPaused },
        }),
      })

      setSettings(nextSettings)
    } catch (error) {
      setErrorMessage(errorUtil.resolveMessage(error))
    }
  }

  const focusSession = async (params: { cwd: string; pid: number }): Promise<void> => {
    const { cwd, pid } = params

    try {
      await sessionsClientService.focusSession({ cwd, pid })
    } catch (error) {
      setErrorMessage(errorUtil.resolveMessage(error))
    }
  }

  const handleToggleSession = (params: { key: string }): void => {
    const { key } = params

    setExpandedSessionKeys((previous) => {
      if (previous.has(key)) {
        return new Set(
          [...previous].filter((candidateKey) => {
            return candidateKey !== key
          }),
        )
      }

      return new Set([...previous, key])
    })
  }

  const refreshIntervalMs = settings?.sessionsRefreshIntervalMs ?? sharedConstant.sessionsRefreshInterval.defaultMs
  const isAutoRefreshPaused = settings?.isSessionsAutoRefreshPaused ?? false

  useEffect(() => {
    void loadSessionsSettings()
  }, [])

  useEffect(() => {
    void loadSessionsSnapshot()
  }, [])

  useEffect(() => {
    return sessionsClientService.subscribeToSessionsUpdates({
      onUpdate: (nextSnapshot) => {
        setSnapshot(nextSnapshot)
        setErrorMessage('')
      },
    })
  }, [])

  useEffect(() => {
    const tickIntervalId = setInterval(() => {
      setNowMs(Date.now())
    }, constant.ui.fastNowTickIntervalMs)

    return () => {
      clearInterval(tickIntervalId)
    }
  }, [])

  const sessions = snapshot?.sessions ?? []
  const hasSnapshot = snapshot !== undefined
  const isEmpty = hasSnapshot && sessions.length === 0
  const displayedErrorMessage = resolveDisplayedErrorMessage({ fetchErrorMessage: errorMessage, snapshot })

  return (
    <div className="sessions">
      <header className="sessions-header">
        <div>
          <h1 className="sessions-title">Sessions</h1>
          <p className="sessions-subtitle">{resolveSummaryLabel(sessions)}</p>
        </div>
        <div className="sessions-actions">
          <SessionsAutoRefreshStatus isPaused={isAutoRefreshPaused} />
          <SessionsAutoRefreshButton
            isPaused={isAutoRefreshPaused}
            onToggle={() => {
              void toggleAutoRefresh()
            }}
          />
          <SessionsRefreshButton
            label="Refresh sessions"
            onClick={() => {
              void loadSessions()
            }}
          />
          <SessionsSshHostsButton
            label="Manage SSH hosts"
            onClick={() => {
              setIsHostsOpen(true)
            }}
          />
          <SessionsSettingsButton
            label="Sessions settings"
            onClick={() => {
              setIsSettingsOpen(true)
            }}
          />
        </div>
      </header>
      <div className="sessions-legend">
        <span className="sessions-legend-item">
          <span className="session-status-dot is-busy" />
          Working
        </span>
        <span className="sessions-legend-item">
          <span className="session-status-dot is-waiting" />
          Waiting for input
        </span>
        <span className="sessions-legend-item">
          <span className="session-status-dot is-idle" />
          Idle
        </span>
      </div>
      {displayedErrorMessage !== '' && <p className="sessions-error">{displayedErrorMessage}</p>}
      {snapshot !== undefined && snapshot.unreachableHosts.length > 0 && (
        <p className="sessions-warning">{resolveUnreachableHostsLabel(snapshot.unreachableHosts)}</p>
      )}
      <main className="sessions-grid">
        {!hasSnapshot && displayedErrorMessage === '' && <p className="sessions-empty">Loading sessions…</p>}
        {!hasSnapshot && displayedErrorMessage !== '' && <p className="sessions-empty">Could not load sessions</p>}
        {isEmpty && <p className="sessions-empty">No active sessions</p>}
        {sessions.map((session) => {
          const sessionKey = resolveSessionKey(session)

          return (
            <SessionsSessionCard
              finishedAtMs={finishedAtBySessionId[session.sessionId]}
              isExpanded={expandedSessionKeys.has(sessionKey)}
              key={sessionKey}
              nowMs={nowMs}
              onFocus={() => {
                void focusSession({ cwd: session.cwd, pid: session.pid })
              }}
              onToggle={() => {
                handleToggleSession({ key: sessionKey })
              }}
              pulseMs={pulseMs}
              session={session}
            />
          )
        })}
      </main>
      <SessionsFocusSupportFooter />
      {isHostsOpen && (
        <SessionsSshHostsDialog
          onClose={() => {
            setIsHostsOpen(false)
          }}
          onSaved={() => {
            void loadSessionsSnapshot()
          }}
        />
      )}
      {isSettingsOpen && (
        <SessionsSettingsDialog
          onClose={() => {
            setIsSettingsOpen(false)
          }}
          onSaved={() => {
            void loadSessionsSettings()
            void loadSessionsSnapshot()
          }}
        />
      )}
      {!isAutoRefreshPaused && snapshot !== undefined && (
        <SessionsRefreshProgressBar
          percent={resolveRefreshProgressPercent({
            cycleStartedAtMs: snapshot.fetchedAt,
            intervalMs: refreshIntervalMs,
            nowMs,
          })}
        />
      )}
    </div>
  )
}
