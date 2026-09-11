import { type ReactElement, useEffect, useState } from 'react'

import { schedulingClientService } from '#src/renderer/src/business/service/scheduling-client-service'
import { usageClientService } from '#src/renderer/src/business/service/usage-client-service'
import { TerminalIcon } from '#src/renderer/src/ui-component/icon/terminal-icon'
import { AddTriggerDialog } from '#src/renderer/src/ui-component/scheduling/add-trigger-dialog'
import { ClearRunsDialog } from '#src/renderer/src/ui-component/scheduling/clear-runs-dialog'
import '#src/renderer/src/ui-component/scheduling/scheduling.css'
import { TriggerPlannerDialog } from '#src/renderer/src/ui-component/scheduling/trigger-planner-dialog'
import { TriggerSettingsDialog } from '#src/renderer/src/ui-component/scheduling/trigger-settings-dialog'
import { TriggerWindowExplainer } from '#src/renderer/src/ui-component/scheduling/trigger-window-explainer'
import '#src/renderer/src/ui-component/schedule/day-time-schedule-fields.css'
import { DashboardAddButton } from '#src/renderer/src/ui-component/usage-dashboard/dashboard-add-button'
import '#src/renderer/src/ui-component/usage-dashboard/usage-dashboard.css'
import { dateUtil } from '#src/renderer/src/util/date-util'
import { errorUtil } from '#src/renderer/src/util/error-util'
import { type TriggerRunSummary, TriggerRunUtil } from '#src/renderer/src/util/trigger-run-util'
import { OS } from '#src/shared/business/enum/os-enum'
import { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'
import { ScheduleTriggerRunPhaseMapper } from '#src/shared/business/enum/schedule-trigger-run-phase-mapper-enum'
import { ScheduleTriggerRunSkipReasonMapper } from '#src/shared/business/enum/schedule-trigger-run-skip-reason-mapper-enum'
import { ScheduleTriggerRunSourceMapper } from '#src/shared/business/enum/schedule-trigger-run-source-mapper-enum'
import type {
  ScheduleTriggerConfig,
  ScheduleTriggerPreset,
  ScheduleTriggerRegistrationHealth,
  ScheduleTriggerRunLogEntry,
  SchedulingInfo,
} from '#src/shared/business/model/schedule-trigger-model'
import { type AppSettings } from '#src/shared/business/model/settings-model'
import { constant } from '#src/shared/util/constant'

const TRIGGER_DAY_LABELS: Record<ScheduleTriggerDayMapper, string> = {
  [ScheduleTriggerDayMapper.FRIDAY]: 'Fri',
  [ScheduleTriggerDayMapper.MONDAY]: 'Mon',
  [ScheduleTriggerDayMapper.SATURDAY]: 'Sat',
  [ScheduleTriggerDayMapper.SUNDAY]: 'Sun',
  [ScheduleTriggerDayMapper.THURSDAY]: 'Thu',
  [ScheduleTriggerDayMapper.TUESDAY]: 'Tue',
  [ScheduleTriggerDayMapper.WEDNESDAY]: 'Wed',
}

const resolvePlatformLabel = (platform: OS): string => {
  switch (platform) {
    case OS.LINUX: {
      return 'Linux'
    }

    case OS.MACOS: {
      return 'macOS'
    }

    case OS.WINDOWS: {
      return 'Windows'
    }

    default: {
      throw new Error(`unsupported platform: ${String(platform)}`)
    }
  }
}

const resolveFinishedOutcome = (params: { exitCode: number }): { className: string; label: string } => {
  if (params.exitCode === 0) {
    return { className: 'trigger-run-badge is-ok', label: 'OK' }
  }

  if (params.exitCode === constant.scheduleTrigger.run.exitCodeTimedOut) {
    return { className: 'trigger-run-badge is-failed', label: 'Timed out' }
  }

  return { className: 'trigger-run-badge is-failed', label: `Exit ${String(params.exitCode)}` }
}

const resolveCardClassName = (params: { isEnabled: boolean }): string => {
  if (params.isEnabled) {
    return 'trigger-card'
  }

  return 'trigger-card is-paused'
}

const resolveRunsButtonClassName = (params: { isExpanded: boolean }): string => {
  if (params.isExpanded) {
    return 'trigger-icon-button is-active'
  }

  return 'trigger-icon-button'
}

const resolveRunsButtonTitle = (params: { isExpanded: boolean }): string => {
  if (params.isExpanded) {
    return 'Hide runs'
  }

  return 'Show runs'
}

const resolveSwitchTitle = (params: { isEnabled: boolean }): string => {
  if (params.isEnabled) {
    return 'Pause trigger'
  }

  return 'Enable trigger'
}

const resolveMasterSwitchTitle = (params: { isEnabled: boolean }): string => {
  if (params.isEnabled) {
    return 'Turn off OS scheduling and unload all registered triggers'
  }

  return 'Turn on OS scheduling and register enabled triggers'
}

const resolveRunDurationPart = (params: { summary: TriggerRunSummary }): string => {
  if (params.summary.phase !== ScheduleTriggerRunPhaseMapper.FINISHED) {
    return ''
  }

  return dateUtil.formatPreciseDuration(params.summary.durationMs)
}

const resolveRunExitCodePart = (params: { summary: TriggerRunSummary }): string => {
  if (params.summary.phase !== ScheduleTriggerRunPhaseMapper.FINISHED) {
    return ''
  }

  return `exit ${String(params.summary.exitCode)}`
}

const resolveRunMeta = (summary: TriggerRunSummary): string => {
  return [
    resolveRunDurationPart({ summary }),
    resolveRunExitCodePart({ summary }),
    resolveRunSourceLabel(summary.trigger),
  ]
    .filter((part) => {
      return part !== ''
    })
    .join(' · ')
}

const resolveRunOutcome = (summary: TriggerRunSummary): { className: string; label: string } => {
  switch (summary.phase) {
    case ScheduleTriggerRunPhaseMapper.FINISHED: {
      return resolveFinishedOutcome({ exitCode: summary.exitCode })
    }

    case ScheduleTriggerRunPhaseMapper.SKIPPED: {
      return resolveSkippedOutcome({ skipReason: summary.skipReason })
    }

    case ScheduleTriggerRunPhaseMapper.STARTED: {
      return { className: 'trigger-run-badge is-running', label: 'Running…' }
    }

    default: {
      throw new Error(`unsupported run phase: ${String(summary.phase)}`)
    }
  }
}

const resolveRunSourceLabel = (source: ScheduleTriggerRunSourceMapper): string => {
  switch (source) {
    case ScheduleTriggerRunSourceMapper.MANUAL: {
      return 'Manual'
    }

    case ScheduleTriggerRunSourceMapper.OS_SCHEDULE: {
      return 'OS schedule'
    }

    default: {
      throw new Error(`unsupported run source: ${String(source)}`)
    }
  }
}

const resolveSkipReasonLabel = (skipReason: ScheduleTriggerRunSkipReasonMapper): string => {
  switch (skipReason) {
    case ScheduleTriggerRunSkipReasonMapper.DISABLED: {
      return 'Disabled'
    }

    case ScheduleTriggerRunSkipReasonMapper.NOT_FOUND: {
      return 'Trigger removed'
    }

    case ScheduleTriggerRunSkipReasonMapper.NOT_SCHEDULED_DAY: {
      return 'Day not scheduled'
    }

    case ScheduleTriggerRunSkipReasonMapper.STALE: {
      return 'Stale fire'
    }

    default: {
      throw new Error(`unsupported skip reason: ${String(skipReason)}`)
    }
  }
}

const resolveSkippedOutcome = (params: {
  skipReason: ScheduleTriggerRunSkipReasonMapper | ''
}): { className: string; label: string } => {
  if (params.skipReason === '') {
    return { className: 'trigger-run-badge is-skipped', label: 'Skipped' }
  }

  return {
    className: 'trigger-run-badge is-skipped',
    label: `Skipped · ${resolveSkipReasonLabel(params.skipReason)}`,
  }
}

const renderGearIcon = (): ReactElement => {
  return (
    <svg
      fill="none"
      height="15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="15"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

const renderPlusIcon = (): ReactElement => {
  return (
    <svg
      fill="none"
      height="12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="12"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

const renderTrashIcon = (): ReactElement => {
  return (
    <svg
      fill="none"
      height="15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="15"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  )
}

export const SchedulingPage = (): ReactElement => {
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined)
  const [schedulingInfo, setSchedulingInfo] = useState<SchedulingInfo | undefined>(undefined)
  const [healthByTriggerId, setHealthByTriggerId] = useState<Record<string, ScheduleTriggerRegistrationHealth>>({})
  const [healthErrorMessage, setHealthErrorMessage] = useState('')
  const [expandedTriggerIds, setExpandedTriggerIds] = useState<Set<string>>(new Set<string>())
  const [runsByTriggerId, setRunsByTriggerId] = useState<Record<string, ScheduleTriggerRunLogEntry[]>>({})
  const [runsErrorMessage, setRunsErrorMessage] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isPlannerOpen, setIsPlannerOpen] = useState(false)
  const [plannerPreset, setPlannerPreset] = useState<ScheduleTriggerPreset | undefined>(undefined)
  const [openTriggerId, setOpenTriggerId] = useState<string | undefined>(undefined)
  const [clearingTriggerId, setClearingTriggerId] = useState<string | undefined>(undefined)

  const loadHealth = async (): Promise<void> => {
    setHealthErrorMessage('')

    try {
      const healthEntries = await schedulingClientService.inspectTriggerRegistrations()
      const nextHealthByTriggerId = healthEntries.reduce<Record<string, ScheduleTriggerRegistrationHealth>>(
        (healthRecord, healthEntry) => {
          return { ...healthRecord, [healthEntry.triggerId]: healthEntry }
        },
        {},
      )

      setHealthByTriggerId(nextHealthByTriggerId)
    } catch (error) {
      setHealthErrorMessage(errorUtil.resolveMessage(error))
    }
  }

  const loadPage = async (): Promise<void> => {
    const [loadedSettings, loadedSchedulingInfo] = await Promise.all([
      usageClientService.getSettings(),
      schedulingClientService.getSchedulingInfo(),
    ])

    setSettings(loadedSettings)
    setSchedulingInfo(loadedSchedulingInfo)

    if (loadedSchedulingInfo.isSupported) {
      await loadHealth()
    }
  }

  const loadRuns = async (params: { triggerId: string }): Promise<void> => {
    setRunsErrorMessage('')

    try {
      const entries = await schedulingClientService.getTriggerRunLogs({ triggerId: params.triggerId })

      setRunsByTriggerId((previous) => {
        return { ...previous, [params.triggerId]: entries }
      })
    } catch (error) {
      setRunsErrorMessage(errorUtil.resolveMessage(error))
    }
  }

  const handleClearRuns = async (params: { triggerId: string }): Promise<void> => {
    setRunsErrorMessage('')

    try {
      await schedulingClientService.clearTriggerRunLogs({ triggerId: params.triggerId })
      await loadRuns({ triggerId: params.triggerId })
    } catch (error) {
      setRunsErrorMessage(errorUtil.resolveMessage(error))
    }
  }

  const handleConfirmClearRuns = async (): Promise<void> => {
    if (clearingTriggerId === undefined) {
      return
    }

    await handleClearRuns({ triggerId: clearingTriggerId })
    setClearingTriggerId(undefined)
  }

  const handleToggleTrigger = async (params: { isEnabled: boolean; triggerId: string }): Promise<void> => {
    const nextSettings = await schedulingClientService.setTriggerEnabled(params)

    setSettings(nextSettings)

    if (schedulingInfo?.isSupported) {
      await loadHealth()
    }
  }

  const handleToggleScheduling = async (params: { isEnabled: boolean }): Promise<void> => {
    const nextSettings = await schedulingClientService.setSchedulingEnabled(params)

    setSettings(nextSettings)

    if (schedulingInfo?.isSupported) {
      await loadHealth()
    }
  }

  const handleSaved = (): void => {
    void loadPage()
  }

  const handleCreateFromPlanner = (preset: ScheduleTriggerPreset): void => {
    setIsPlannerOpen(false)
    setPlannerPreset(preset)
    setIsAddOpen(true)
  }

  const handleToggleRuns = (params: { triggerId: string }): void => {
    const isExpanded = expandedTriggerIds.has(params.triggerId)

    setExpandedTriggerIds((previous) => {
      if (isExpanded) {
        return new Set(
          [...previous].filter((candidateTriggerId) => {
            return candidateTriggerId !== params.triggerId
          }),
        )
      }

      return new Set([...previous, params.triggerId])
    })

    if (!isExpanded) {
      void loadRuns({ triggerId: params.triggerId })
    }
  }

  useEffect(() => {
    void loadPage()
  }, [])

  const resolveDayChipClassName = (days: ScheduleTriggerDayMapper[], day: ScheduleTriggerDayMapper): string => {
    if (days.includes(day)) {
      return 'trigger-chip is-active'
    }

    return 'trigger-chip'
  }

  const resolveBadge = (trigger: ScheduleTriggerConfig): { className: string; label: string } => {
    if (!schedulingInfo?.isSupported) {
      return { className: 'trigger-badge', label: '—' }
    }

    if (!settings?.isSchedulingEnabled) {
      return { className: 'trigger-badge', label: 'Off' }
    }

    if (!trigger.isEnabled) {
      return { className: 'trigger-badge', label: 'Paused' }
    }

    if (healthByTriggerId[trigger.id]?.isRegistered) {
      return { className: 'trigger-badge is-registered', label: 'Registered' }
    }

    return { className: 'trigger-badge is-missing', label: 'Missing' }
  }

  const resolveRunsContent = (params: { triggerId: string }): ReactElement => {
    const entries = runsByTriggerId[params.triggerId]

    if (runsErrorMessage !== '') {
      return <p className="trigger-run-empty">{runsErrorMessage}</p>
    }

    if (entries === undefined) {
      return <p className="trigger-run-empty">Loading runs…</p>
    }

    const summaries = new TriggerRunUtil().groupRunsByEventId({ entries })

    if (summaries.length === 0) {
      return <p className="trigger-run-empty">No runs recorded yet.</p>
    }

    return (
      <>
        {summaries.map((summary) => {
          const outcome = resolveRunOutcome(summary)

          return (
            <div className="trigger-run-row" key={summary.eventId}>
              <div className="trigger-run-row-head">
                <span className="trigger-run-time">
                  {dateUtil.formatDateTime(Date.parse(summary.startedAtTimestamp))}
                </span>
                <span className={outcome.className}>{outcome.label}</span>
                <span className="trigger-run-meta">{resolveRunMeta(summary)}</span>
              </div>
              {summary.outputSnippet !== '' && (
                <code className="trigger-run-output" title={summary.outputSnippet}>
                  {summary.outputSnippet}
                </code>
              )}
            </div>
          )
        })}
      </>
    )
  }

  if (settings === undefined || schedulingInfo === undefined) {
    return (
      <div className="scheduling">
        <p className="provider-card-message">Loading scheduling…</p>
      </div>
    )
  }

  const triggers = settings.triggers

  return (
    <div className="scheduling">
      <header className="dashboard-header">
        <div>
          <div className="scheduling-title-row">
            <h1 className="dashboard-title">Scheduling</h1>
            <div className="scheduling-master">
              <label className="trigger-switch">
                <input
                  aria-describedby="scheduling-master-tip"
                  aria-label={resolveMasterSwitchTitle({ isEnabled: settings.isSchedulingEnabled })}
                  checked={settings.isSchedulingEnabled}
                  onChange={(event) => {
                    void handleToggleScheduling({
                      isEnabled: event.target.checked,
                    })
                  }}
                  type="checkbox"
                />
                <span className="trigger-switch-track">
                  <span className="trigger-switch-knob" />
                </span>
              </label>
              <div className="scheduling-master-tip" id="scheduling-master-tip" role="tooltip">
                <p className="trigger-explainer-title">OS scheduling</p>
                <p className="trigger-explainer-text">
                  Master switch for the whole scheduler. On — enabled triggers are registered with your OS scheduler and
                  fire in the background, even when the app is closed. Off — all triggers are unloaded and nothing
                  fires.
                </p>
              </div>
            </div>
          </div>
          <p className="dashboard-subtitle">Run commands on a schedule through your OS scheduler</p>
        </div>
        <div className="dashboard-actions">
          <button
            className="button"
            onClick={() => {
              setIsPlannerOpen(true)
            }}
            type="button"
          >
            Plan windows
          </button>
          <DashboardAddButton
            label="Add trigger"
            onClick={() => {
              setIsAddOpen(true)
            }}
          />
        </div>
      </header>
      {!schedulingInfo.isSupported && (
        <div className="scheduling-banner">
          OS scheduling is not available on {resolvePlatformLabel(schedulingInfo.platform)} yet. Triggers are saved but
          will not fire.
        </div>
      )}
      {!settings.isSchedulingEnabled && (
        <div className="scheduling-banner">
          OS scheduling is turned off. Nothing is registered with your OS scheduler, all triggers have been unloaded and
          none will fire in the background.
        </div>
      )}
      {healthErrorMessage !== '' && <div className="scheduling-banner">{healthErrorMessage}</div>}
      <main className="scheduling-list">
        {triggers.map((trigger) => {
          const badge = resolveBadge(trigger)
          const isExpanded = expandedTriggerIds.has(trigger.id)

          return (
            <article
              className={resolveCardClassName({ isEnabled: settings.isSchedulingEnabled && trigger.isEnabled })}
              key={trigger.id}
            >
              <header className="trigger-card-header">
                <div className="trigger-card-heading">
                  <h2 className="trigger-card-title">{trigger.name}</h2>
                  <code className="trigger-card-command" title={trigger.command}>
                    {trigger.command}
                  </code>
                </div>
                <label className="trigger-switch" title={resolveSwitchTitle({ isEnabled: trigger.isEnabled })}>
                  <input
                    aria-label={resolveSwitchTitle({ isEnabled: trigger.isEnabled })}
                    checked={trigger.isEnabled}
                    onChange={(event) => {
                      void handleToggleTrigger({
                        isEnabled: event.target.checked,
                        triggerId: trigger.id,
                      })
                    }}
                    type="checkbox"
                  />
                  <span className="trigger-switch-track">
                    <span className="trigger-switch-knob" />
                  </span>
                </label>
              </header>
              <div className="trigger-card-chips">
                {constant.scheduleTrigger.days.map((day) => {
                  return (
                    <span className={resolveDayChipClassName(trigger.days, day)} key={day}>
                      {TRIGGER_DAY_LABELS[day]}
                    </span>
                  )
                })}
              </div>
              {expandedTriggerIds.has(trigger.id) && (
                <div className="trigger-runs">
                  <div className="trigger-runs-toolbar">
                    <button
                      aria-label="Clear run logs"
                      className="trigger-icon-button is-danger"
                      onClick={() => {
                        setClearingTriggerId(trigger.id)
                      }}
                      title="Clear run logs"
                      type="button"
                    >
                      {renderTrashIcon()}
                    </button>
                  </div>
                  {resolveRunsContent({ triggerId: trigger.id })}
                </div>
              )}
              <footer className="trigger-card-footer">
                <span className="trigger-card-times">{trigger.times.join(' · ')}</span>
                <span className={badge.className}>{badge.label}</span>
                <div className="trigger-card-actions">
                  <button
                    aria-label={resolveRunsButtonTitle({ isExpanded })}
                    className={resolveRunsButtonClassName({ isExpanded })}
                    onClick={() => {
                      handleToggleRuns({ triggerId: trigger.id })
                    }}
                    title={resolveRunsButtonTitle({ isExpanded })}
                    type="button"
                  >
                    <TerminalIcon />
                  </button>
                  <button
                    aria-label="Edit trigger"
                    className="trigger-icon-button"
                    onClick={() => {
                      setOpenTriggerId(trigger.id)
                    }}
                    title="Edit trigger"
                    type="button"
                  >
                    {renderGearIcon()}
                  </button>
                </div>
              </footer>
            </article>
          )
        })}
        {triggers.length === 0 && (
          <div className="dashboard-empty-state">
            <p className="dashboard-empty">No triggers yet. Add one to run commands on a schedule.</p>
            <button
              className="button button-primary"
              onClick={() => {
                setIsAddOpen(true)
              }}
              type="button"
            >
              Add trigger
            </button>
          </div>
        )}
      </main>
      <footer className="scheduling-footer">
        <div className="scheduling-preset">
          <span className="scheduling-preset-label">Preset</span>
          <button
            className="scheduling-preset-button"
            onClick={() => {
              setIsAddOpen(true)
            }}
            type="button"
          >
            {renderPlusIcon()}
            Max 5h windows
          </button>
          <TriggerWindowExplainer />
        </div>
      </footer>
      {isAddOpen && (
        <AddTriggerDialog
          initialPreset={plannerPreset}
          onClose={() => {
            setIsAddOpen(false)
            setPlannerPreset(undefined)
          }}
          onSaved={handleSaved}
        />
      )}
      {isPlannerOpen && (
        <TriggerPlannerDialog
          onClose={() => {
            setIsPlannerOpen(false)
          }}
          onCreateTrigger={handleCreateFromPlanner}
        />
      )}
      {openTriggerId !== undefined && (
        <TriggerSettingsDialog
          onClose={() => {
            setOpenTriggerId(undefined)
          }}
          onSaved={handleSaved}
          triggerId={openTriggerId}
        />
      )}
      {clearingTriggerId !== undefined && (
        <ClearRunsDialog
          onClose={() => {
            setClearingTriggerId(undefined)
          }}
          onConfirm={() => {
            void handleConfirmClearRuns()
          }}
        />
      )}
    </div>
  )
}
