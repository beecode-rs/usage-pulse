import { type ReactElement, useEffect, useRef, useState } from 'react'

import { AppViewIdMapper } from '#src/renderer/src/business/model/app-view-id-mapper-enum'
import { MenuStatusDotMapper } from '#src/renderer/src/business/model/menu-status-dot-mapper-enum'
import { sessionsClientService } from '#src/renderer/src/business/service/sessions-client-service'
import { usageClientService } from '#src/renderer/src/business/service/usage-client-service'
import { AboutPage } from '#src/renderer/src/ui-component/about/about-page'
import { AppFooter } from '#src/renderer/src/ui-component/app-shell/app-footer'
import '#src/renderer/src/ui-component/app-shell/app-shell.css'
import { DashboardPage } from '#src/renderer/src/ui-component/dashboard/dashboard-page'
import { DevelopmentPage } from '#src/renderer/src/ui-component/development/development-page'
import { SchedulingPage } from '#src/renderer/src/ui-component/scheduling/scheduling-page'
import { SessionsPage } from '#src/renderer/src/ui-component/sessions/sessions-page'
import { SideMenu, type SideMenuItem } from '#src/renderer/src/ui-component/side-menu/side-menu'
import { UsageDashboard } from '#src/renderer/src/ui-component/usage-dashboard/usage-dashboard'
import { developmentPrefsUtil } from '#src/renderer/src/util/development-prefs-util'
import { errorUtil } from '#src/renderer/src/util/error-util'
import { MenuStatusUtil } from '#src/renderer/src/util/menu-status-util'
import { sessionFinishedPulseUtil } from '#src/renderer/src/util/session-finished-pulse-util'
import { SessionSoundUtil } from '#src/renderer/src/util/session-sound-util'
import { sideMenuPrefsUtil } from '#src/renderer/src/util/side-menu-prefs-util'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import type { SessionInfo, SessionSnapshot } from '#src/shared/business/model/session-model'
import type { AppSettings } from '#src/shared/business/model/settings-model'
import type { UsageSnapshot } from '#src/shared/business/model/usage-model'
import { constant } from '#src/shared/util/constant'

const DEFAULT_ELAPSED_MINUTES = 60
const DEFAULT_USED_PERCENT = 45
const NOW_TICK_INTERVAL_MS = 30_000
const PEAK_STATUS_DOT_TITLE = 'z.ai peak hours: premium models bill at 3× credits (weekdays 14:00–18:00 UTC+8)'

const resolveStatusDotTitle = (params: { statusDot?: MenuStatusDotMapper }): string | undefined => {
  if (params.statusDot === MenuStatusDotMapper.PEAK) {
    return PEAK_STATUS_DOT_TITLE
  }

  return undefined
}

const MENU_ICONS: Record<AppViewIdMapper, ReactElement> = {
  [AppViewIdMapper.ABOUT]: (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="16" y2="12" />
      <line x1="12" x2="12.01" y1="8" y2="8" />
    </svg>
  ),
  [AppViewIdMapper.DASHBOARD]: (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <rect height="7" rx="1" width="7" x="3" y="3" />
      <rect height="7" rx="1" width="7" x="14" y="3" />
      <rect height="7" rx="1" width="7" x="14" y="14" />
      <rect height="7" rx="1" width="7" x="3" y="14" />
    </svg>
  ),
  [AppViewIdMapper.DEVELOPMENT]: (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  ),
  [AppViewIdMapper.SCHEDULING]: (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  [AppViewIdMapper.SESSIONS]: (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <rect height="13" rx="2" width="20" x="2" y="3" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="16" y2="21" />
    </svg>
  ),
  [AppViewIdMapper.USAGE]: (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <polyline points="3 12 7 12 10 5 14 19 17 12 21 12" />
    </svg>
  ),
}

const resolveMenuItems = (params: {
  dashboardStatusDot: MenuStatusDotMapper | undefined
  isSchedulingLive: boolean
  isSessionsLive: boolean
  isUsageLive: boolean
  sessionsStatusDot: MenuStatusDotMapper | undefined
  usageStatusDot: MenuStatusDotMapper | undefined
}): SideMenuItem<AppViewIdMapper>[] => {
  return [
    {
      icon: MENU_ICONS[AppViewIdMapper.DASHBOARD],
      id: AppViewIdMapper.DASHBOARD,
      label: 'Dashboard',
      statusDot: params.dashboardStatusDot,
      statusDotTitle: resolveStatusDotTitle({ statusDot: params.dashboardStatusDot }),
    },
    {
      icon: MENU_ICONS[AppViewIdMapper.SESSIONS],
      id: AppViewIdMapper.SESSIONS,
      isLive: params.isSessionsLive,
      label: 'Sessions',
      statusDot: params.sessionsStatusDot,
    },
    {
      icon: MENU_ICONS[AppViewIdMapper.USAGE],
      id: AppViewIdMapper.USAGE,
      isLive: params.isUsageLive,
      label: 'Usage',
      statusDot: params.usageStatusDot,
      statusDotTitle: resolveStatusDotTitle({ statusDot: params.usageStatusDot }),
    },
    {
      icon: MENU_ICONS[AppViewIdMapper.SCHEDULING],
      id: AppViewIdMapper.SCHEDULING,
      isLive: params.isSchedulingLive,
      label: 'Scheduling',
    },
  ]
}

const resolveFooterMenuItems = (params: {
  developmentStatusDot: MenuStatusDotMapper | undefined
  isDevelopmentUnlocked: boolean
}): SideMenuItem<AppViewIdMapper>[] => {
  const footerMenuItems: SideMenuItem<AppViewIdMapper>[] = [
    { icon: MENU_ICONS[AppViewIdMapper.ABOUT], id: AppViewIdMapper.ABOUT, label: 'About' },
  ]

  if (!params.isDevelopmentUnlocked) {
    return footerMenuItems
  }

  return [
    ...footerMenuItems,
    {
      icon: MENU_ICONS[AppViewIdMapper.DEVELOPMENT],
      id: AppViewIdMapper.DEVELOPMENT,
      label: 'Development',
      statusDot: params.developmentStatusDot,
    },
  ]
}

const resolveIsUsageLive = (params: { settings?: AppSettings }): boolean => {
  const trackers = params.settings?.trackers ?? []

  return trackers.some((tracker) => {
    return !tracker.isAutoRefreshPaused
  })
}

const resolveIsSchedulingLive = (params: { settings?: AppSettings }): boolean => {
  return params.settings?.isSchedulingEnabled === true
}

const resolveIsSessionsLive = (params: { settings?: AppSettings }): boolean => {
  return params.settings?.isSessionsAutoRefreshPaused === false
}

export const AppShell = (): ReactElement => {
  const [activeViewId, setActiveViewId] = useState<AppViewIdMapper>(AppViewIdMapper.DASHBOARD)
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(DEFAULT_ELAPSED_MINUTES)
  const [finishedAtBySessionId, setFinishedAtBySessionId] = useState<Record<string, number>>({})
  const [isCollapsed, setIsCollapsed] = useState<boolean>(sideMenuPrefsUtil.loadIsCollapsed)
  const [isDevelopmentUnlocked, setIsDevelopmentUnlocked] = useState<boolean>(developmentPrefsUtil.loadIsUnlocked)
  const [nowMs, setNowMs] = useState<number>((): number => {
    return Date.now()
  })
  const [sessionSnapshot, setSessionSnapshot] = useState<SessionSnapshot | undefined>(undefined)
  const [sessionsErrorMessage, setSessionsErrorMessage] = useState('')
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined)
  const [usageSnapshot, setUsageSnapshot] = useState<UsageSnapshot | undefined>(undefined)
  const [usedPercent, setUsedPercent] = useState<number>(DEFAULT_USED_PERCENT)
  const previousSessionsRef = useRef<SessionInfo[] | undefined>(undefined)
  const settingsRef = useRef<AppSettings | undefined>(undefined)

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        setSettings(await usageClientService.getSettings())
      } catch {
        return
      }
    }

    void loadSettings()

    return usageClientService.subscribeToSettingsUpdates({
      onUpdate: (nextSettings) => {
        setSettings(nextSettings)
      },
    })
  }, [])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    const loadUsageSnapshot = async (): Promise<void> => {
      try {
        setUsageSnapshot(await usageClientService.getSnapshot())
      } catch {
        return
      }
    }

    void loadUsageSnapshot()

    return usageClientService.subscribeToUsageUpdates({
      onUpdate: (nextSnapshot) => {
        setUsageSnapshot(nextSnapshot)
      },
    })
  }, [])

  useEffect(() => {
    const playSessionSounds = (params: { nextSnapshot: SessionSnapshot; previousSessions?: SessionInfo[] }): void => {
      const sessionSoundUtil = new SessionSoundUtil()
      const newlyFinishedSessionIds = sessionSoundUtil.resolveStatusTransitionSessionIds({
        currentSessions: params.nextSnapshot.sessions,
        fromStatus: SessionStatusMapper.BUSY,
        previousSessions: params.previousSessions,
        toStatus: SessionStatusMapper.IDLE,
      })
      const newlyWaitingSessionIds = sessionSoundUtil.resolveNewlyStatusSessionIds({
        currentSessions: params.nextSnapshot.sessions,
        previousSessions: params.previousSessions,
        status: SessionStatusMapper.WAITING,
      })
      const soundVolumePercent = settingsRef.current?.soundVolumePercent ?? constant.soundVolume.defaultPercent

      if (newlyWaitingSessionIds.length > 0) {
        sessionSoundUtil.playSessionSound({
          soundId: settingsRef.current?.waitingSoundId ?? constant.waitingSound.defaultId,
          volumePercent: soundVolumePercent,
        })
      }

      if (newlyFinishedSessionIds.length > 0) {
        sessionSoundUtil.playSessionSound({
          soundId: settingsRef.current?.sessionFinishedSoundId ?? constant.sessionFinishedSound.defaultId,
          volumePercent: soundVolumePercent,
        })
      }
    }

    const trackFinishedSessions = (params: {
      nextSnapshot: SessionSnapshot
      previousSessions?: SessionInfo[]
    }): void => {
      setFinishedAtBySessionId((currentFinishedAtBySessionId) => {
        return sessionFinishedPulseUtil.resolveFinishedAtBySessionId({
          currentSessions: params.nextSnapshot.sessions,
          finishedAtBySessionId: currentFinishedAtBySessionId,
          nowMs: Date.now(),
          previousSessions: params.previousSessions,
        })
      })
    }

    const handleSessionsSnapshot = (nextSnapshot: SessionSnapshot): void => {
      setSessionSnapshot(nextSnapshot)
      setSessionsErrorMessage('')

      const hasSnapshotError = nextSnapshot.errorMessage !== undefined && nextSnapshot.errorMessage !== ''

      if (hasSnapshotError) {
        return
      }

      const previousSessions = previousSessionsRef.current

      previousSessionsRef.current = nextSnapshot.sessions
      trackFinishedSessions({ nextSnapshot, previousSessions })
      playSessionSounds({ nextSnapshot, previousSessions })
    }

    const loadSessions = async (): Promise<void> => {
      try {
        handleSessionsSnapshot(await sessionsClientService.resolveSessionsSnapshot())
      } catch (error) {
        setSessionsErrorMessage(errorUtil.resolveMessage(error))
      }
    }

    void loadSessions()

    return sessionsClientService.subscribeToSessionsUpdates({ onUpdate: handleSessionsSnapshot })
  }, [])

  useEffect(() => {
    const tickIntervalId = setInterval(() => {
      setNowMs(Date.now())
    }, NOW_TICK_INTERVAL_MS)

    return () => {
      clearInterval(tickIntervalId)
    }
  }, [])

  const finishedPulseMs = settings?.sessionFinishedPulseMs ?? constant.sessionFinishedPulse.defaultMs
  const menuStatusUtil = new MenuStatusUtil()
  const peakStatusDot = menuStatusUtil.resolvePeakStatusDot({ now: nowMs, snapshot: usageSnapshot })
  const sessionsStatusDot = menuStatusUtil.resolveSessionsStatusDot({
    hasLoadError: sessionsErrorMessage !== '',
    snapshot: sessionSnapshot,
  })
  const usageStatusDot = menuStatusUtil.resolveCombinedStatusDot({
    dots: [menuStatusUtil.resolveUsageStatusDot({ now: nowMs, snapshot: usageSnapshot }), peakStatusDot],
  })
  const dashboardStatusDot = menuStatusUtil.resolveCombinedStatusDot({
    dots: [usageStatusDot, sessionsStatusDot],
  })
  const developmentStatusDot = menuStatusUtil.resolveDevelopmentStatusDot({ elapsedMinutes, now: nowMs, usedPercent })
  const menuItems = resolveMenuItems({
    dashboardStatusDot,
    isSchedulingLive: resolveIsSchedulingLive({ settings }),
    isSessionsLive: resolveIsSessionsLive({ settings }),
    isUsageLive: resolveIsUsageLive({ settings }),
    sessionsStatusDot,
    usageStatusDot,
  })
  const footerMenuItems = resolveFooterMenuItems({
    developmentStatusDot,
    isDevelopmentUnlocked,
  })
  const brandStatusDot = menuStatusUtil.resolveCombinedStatusDot({
    dots: [...menuItems, ...footerMenuItems].map((item) => {
      return item.statusDot
    }),
  })

  const handleSelectItem = (viewId: AppViewIdMapper): void => {
    setActiveViewId(viewId)
  }

  const handleToggleDevelopmentUnlock = (): void => {
    const nextIsDevelopmentUnlocked = !isDevelopmentUnlocked

    setIsDevelopmentUnlocked(nextIsDevelopmentUnlocked)
    developmentPrefsUtil.saveIsUnlocked({ isUnlocked: nextIsDevelopmentUnlocked })
  }

  const handleToggleCollapse = (): void => {
    const nextIsCollapsed = !isCollapsed

    setIsCollapsed(nextIsCollapsed)
    sideMenuPrefsUtil.saveIsCollapsed({ isCollapsed: nextIsCollapsed })
  }

  const renderActiveView = (): ReactElement => {
    switch (activeViewId) {
      case AppViewIdMapper.ABOUT: {
        return <AboutPage onToggleDevelopmentUnlock={handleToggleDevelopmentUnlock} />
      }

      case AppViewIdMapper.DASHBOARD: {
        return (
          <DashboardPage
            finishedAtBySessionId={finishedAtBySessionId}
            onNavigate={handleSelectItem}
            pulseMs={finishedPulseMs}
          />
        )
      }

      case AppViewIdMapper.DEVELOPMENT: {
        return (
          <DevelopmentPage
            elapsedMinutes={elapsedMinutes}
            onElapsedMinutesChange={setElapsedMinutes}
            onUsedPercentChange={setUsedPercent}
            usedPercent={usedPercent}
          />
        )
      }

      case AppViewIdMapper.SCHEDULING: {
        return <SchedulingPage />
      }

      case AppViewIdMapper.SESSIONS: {
        return <SessionsPage finishedAtBySessionId={finishedAtBySessionId} pulseMs={finishedPulseMs} />
      }

      case AppViewIdMapper.USAGE: {
        return <UsageDashboard />
      }

      default: {
        throw new Error(`unsupported view: ${String(activeViewId)}`)
      }
    }
  }

  return (
    <div className="app-shell">
      <SideMenu
        activeItemId={activeViewId}
        footerItems={footerMenuItems}
        isCollapsed={isCollapsed}
        items={menuItems}
        onSelectItem={handleSelectItem}
        onToggleCollapse={handleToggleCollapse}
        statusDot={brandStatusDot}
        statusDotTitle={resolveStatusDotTitle({ statusDot: brandStatusDot })}
        title="Usage Pulse"
      />
      <div className="app-shell-main">
        <div className="app-shell-content">{renderActiveView()}</div>
        <AppFooter />
      </div>
    </div>
  )
}
