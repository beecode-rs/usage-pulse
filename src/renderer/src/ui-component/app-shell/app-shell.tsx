import { type ReactElement, useEffect, useRef, useState } from 'react'

import { sessionsClientService } from '#src/renderer/src/business/service/sessions-client-service'
import { usageClientService } from '#src/renderer/src/business/service/usage-client-service'
import { AboutPage } from '#src/renderer/src/ui-component/about/about-page'
import { AppFooter } from '#src/renderer/src/ui-component/app-shell/app-footer'
import '#src/renderer/src/ui-component/app-shell/app-shell.css'
import { DashboardPage } from '#src/renderer/src/ui-component/dashboard/dashboard-page'
import { DevelopmentPage } from '#src/renderer/src/ui-component/development/development-page'
import { SchedulingPage } from '#src/renderer/src/ui-component/scheduling/scheduling-page'
import { SessionsPage } from '#src/renderer/src/ui-component/sessions/sessions-page'
import { type ISideMenuItem, SideMenu } from '#src/renderer/src/ui-component/side-menu/side-menu'
import { UsageDashboard } from '#src/renderer/src/ui-component/usage-dashboard/usage-dashboard'
import { developmentPrefsUtil } from '#src/renderer/src/util/development-prefs-util'
import { errorUtil } from '#src/renderer/src/util/error-util'
import { type MenuStatusDot, MenuStatusUtil } from '#src/renderer/src/util/menu-status-util'
import { sessionFinishedPulseUtil } from '#src/renderer/src/util/session-finished-pulse-util'
import { SessionSoundUtil } from '#src/renderer/src/util/session-sound-util'
import { sideMenuPrefsUtil } from '#src/renderer/src/util/side-menu-prefs-util'
import type { ISessionInfo, ISessionSnapshot } from '#src/shared/session-model'
import {
  DEFAULT_SESSION_FINISHED_PULSE_SECONDS,
  DEFAULT_SESSION_FINISHED_SOUND_ID,
  DEFAULT_SOUND_VOLUME_PERCENT,
  DEFAULT_WAITING_SOUND_ID,
  type IAppSettings,
} from '#src/shared/settings-model'
import type { IUsageSnapshot } from '#src/shared/usage-model'

type AppViewId = 'about' | 'dashboard' | 'development' | 'scheduling' | 'sessions' | 'usage'

const DEFAULT_ELAPSED_MINUTES = 60
const DEFAULT_USED_PERCENT = 45
const NOW_TICK_INTERVAL_MS = 30_000
const PEAK_STATUS_DOT_TITLE = 'z.ai peak hours: premium models bill at 3× credits (weekdays 14:00–18:00 UTC+8)'

const resolveStatusDotTitle = (params: { statusDot?: MenuStatusDot }): string | undefined => {
  if (params.statusDot === 'peak') {
    return PEAK_STATUS_DOT_TITLE
  }

  return undefined
}

const MENU_ICONS: Record<AppViewId, ReactElement> = {
  about: (
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
  dashboard: (
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
  development: (
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
  scheduling: (
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
  sessions: (
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
  usage: (
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
  dashboardStatusDot: MenuStatusDot | undefined
  isSchedulingLive: boolean
  isSessionsLive: boolean
  isUsageLive: boolean
  sessionsStatusDot: MenuStatusDot | undefined
  usageStatusDot: MenuStatusDot | undefined
}): ISideMenuItem<AppViewId>[] => {
  return [
    {
      icon: MENU_ICONS.dashboard,
      id: 'dashboard',
      label: 'Dashboard',
      statusDot: params.dashboardStatusDot,
      statusDotTitle: resolveStatusDotTitle({ statusDot: params.dashboardStatusDot }),
    },
    {
      icon: MENU_ICONS.sessions,
      id: 'sessions',
      isLive: params.isSessionsLive,
      label: 'Sessions',
      statusDot: params.sessionsStatusDot,
    },
    {
      icon: MENU_ICONS.usage,
      id: 'usage',
      isLive: params.isUsageLive,
      label: 'Usage',
      statusDot: params.usageStatusDot,
      statusDotTitle: resolveStatusDotTitle({ statusDot: params.usageStatusDot }),
    },
    { icon: MENU_ICONS.scheduling, id: 'scheduling', isLive: params.isSchedulingLive, label: 'Scheduling' },
  ]
}

const resolveFooterMenuItems = (params: {
  developmentStatusDot: MenuStatusDot | undefined
  isDevelopmentUnlocked: boolean
}): ISideMenuItem<AppViewId>[] => {
  const footerMenuItems: ISideMenuItem<AppViewId>[] = [{ icon: MENU_ICONS.about, id: 'about', label: 'About' }]

  if (!params.isDevelopmentUnlocked) {
    return footerMenuItems
  }

  return [
    ...footerMenuItems,
    { icon: MENU_ICONS.development, id: 'development', label: 'Development', statusDot: params.developmentStatusDot },
  ]
}

const resolveIsUsageLive = (params: { settings?: IAppSettings }): boolean => {
  const trackers = params.settings?.trackers ?? []

  return trackers.some((tracker) => {
    return !tracker.isAutoRefreshPaused
  })
}

const resolveIsSchedulingLive = (params: { settings?: IAppSettings }): boolean => {
  return params.settings?.isSchedulingEnabled === true
}

const resolveIsSessionsLive = (params: { settings?: IAppSettings }): boolean => {
  return params.settings?.isSessionsAutoRefreshPaused === false
}

export const AppShell = (): ReactElement => {
  const [activeViewId, setActiveViewId] = useState<AppViewId>('dashboard')
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(DEFAULT_ELAPSED_MINUTES)
  const [finishedAtBySessionId, setFinishedAtBySessionId] = useState<Record<string, number>>({})
  const [isCollapsed, setIsCollapsed] = useState<boolean>(sideMenuPrefsUtil.loadIsCollapsed)
  const [isDevelopmentUnlocked, setIsDevelopmentUnlocked] = useState<boolean>(developmentPrefsUtil.loadIsUnlocked)
  const [nowMs, setNowMs] = useState<number>((): number => {
    return Date.now()
  })
  const [sessionSnapshot, setSessionSnapshot] = useState<ISessionSnapshot | undefined>(undefined)
  const [sessionsErrorMessage, setSessionsErrorMessage] = useState('')
  const [settings, setSettings] = useState<IAppSettings | undefined>(undefined)
  const [usageSnapshot, setUsageSnapshot] = useState<IUsageSnapshot | undefined>(undefined)
  const [usedPercent, setUsedPercent] = useState<number>(DEFAULT_USED_PERCENT)
  const previousSessionsRef = useRef<ISessionInfo[] | undefined>(undefined)
  const settingsRef = useRef<IAppSettings | undefined>(undefined)

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
    const playSessionSounds = (params: { nextSnapshot: ISessionSnapshot; previousSessions?: ISessionInfo[] }): void => {
      const sessionSoundUtil = new SessionSoundUtil()
      const newlyFinishedSessionIds = sessionSoundUtil.resolveStatusTransitionSessionIds({
        currentSessions: params.nextSnapshot.sessions,
        fromStatus: 'busy',
        previousSessions: params.previousSessions,
        toStatus: 'idle',
      })
      const newlyWaitingSessionIds = sessionSoundUtil.resolveNewlyStatusSessionIds({
        currentSessions: params.nextSnapshot.sessions,
        previousSessions: params.previousSessions,
        status: 'waiting',
      })
      const soundVolumePercent = settingsRef.current?.soundVolumePercent ?? DEFAULT_SOUND_VOLUME_PERCENT

      if (newlyWaitingSessionIds.length > 0) {
        sessionSoundUtil.playSessionSound({
          soundId: settingsRef.current?.waitingSoundId ?? DEFAULT_WAITING_SOUND_ID,
          volumePercent: soundVolumePercent,
        })
      }

      if (newlyFinishedSessionIds.length > 0) {
        sessionSoundUtil.playSessionSound({
          soundId: settingsRef.current?.sessionFinishedSoundId ?? DEFAULT_SESSION_FINISHED_SOUND_ID,
          volumePercent: soundVolumePercent,
        })
      }
    }

    const trackFinishedSessions = (params: {
      nextSnapshot: ISessionSnapshot
      previousSessions?: ISessionInfo[]
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

    const handleSessionsSnapshot = (nextSnapshot: ISessionSnapshot): void => {
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

  const finishedPulseSeconds = settings?.sessionFinishedPulseSeconds ?? DEFAULT_SESSION_FINISHED_PULSE_SECONDS
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

  const handleSelectItem = (viewId: AppViewId): void => {
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
      case 'about': {
        return <AboutPage onToggleDevelopmentUnlock={handleToggleDevelopmentUnlock} />
      }

      case 'dashboard': {
        return (
          <DashboardPage
            finishedAtBySessionId={finishedAtBySessionId}
            onNavigate={handleSelectItem}
            pulseSeconds={finishedPulseSeconds}
          />
        )
      }

      case 'development': {
        return (
          <DevelopmentPage
            elapsedMinutes={elapsedMinutes}
            onElapsedMinutesChange={setElapsedMinutes}
            onUsedPercentChange={setUsedPercent}
            usedPercent={usedPercent}
          />
        )
      }

      case 'scheduling': {
        return <SchedulingPage />
      }

      case 'sessions': {
        return <SessionsPage finishedAtBySessionId={finishedAtBySessionId} pulseSeconds={finishedPulseSeconds} />
      }

      case 'usage': {
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
