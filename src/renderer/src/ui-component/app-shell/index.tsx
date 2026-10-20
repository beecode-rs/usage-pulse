import { typeUtil } from '@beecode/msh-util'
import { type ReactElement, useEffect, useRef, useState } from 'react'

import { AppViewIdMapper } from '#src/renderer/src/business/enum/app-view-id-mapper-enum'
import { MenuStatusDotMapper } from '#src/renderer/src/business/enum/menu-status-dot-mapper-enum'
import { MenuStatusService } from '#src/renderer/src/business/service/menu-status-service'
import { sessionFinishedPulseService } from '#src/renderer/src/business/service/session-finished-pulse-service'
import { SessionSoundService } from '#src/renderer/src/business/service/session-sound-service'
import { sessionsClientService } from '#src/renderer/src/business/service/sessions-client-service'
import { usageClientService } from '#src/renderer/src/business/service/usage-client-service'
import { UsageStalenessService } from '#src/renderer/src/business/service/usage-staleness-service'
import { AboutPage } from '#src/renderer/src/ui-component/about/page'
import { AppShellFooter } from '#src/renderer/src/ui-component/app-shell/footer'
import '#src/renderer/src/ui-component/app-shell/app-shell.css'
import { DashboardPage } from '#src/renderer/src/ui-component/dashboard/page'
import { DevelopmentPage } from '#src/renderer/src/ui-component/development/page'
import { MobilePage } from '#src/renderer/src/ui-component/mobile/page'
import { SchedulingPage } from '#src/renderer/src/ui-component/scheduling/page'
import { SessionsPage } from '#src/renderer/src/ui-component/sessions/page'
import { SideMenu, type SideMenuItem } from '#src/renderer/src/ui-component/side-menu/index'
import { UsageDashboard } from '#src/renderer/src/ui-component/usage-dashboard/index'
import { constant } from '#src/renderer/src/util/constant'
import { developmentPrefsUtil } from '#src/renderer/src/util/development-prefs-util'
import { sideMenuPrefsUtil } from '#src/renderer/src/util/side-menu-prefs-util'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import type { SessionInfo, SessionSnapshot } from '#src/shared/business/model/session-model'
import type { SettingsModel } from '#src/shared/business/model/settings-model'
import type { UsageSnapshot } from '#src/shared/business/model/usage-model'
import { sessionStatusTransitionService } from '#src/shared/business/service/session-status-transition-service'
import { appTitleUtil } from '#src/shared/util/app-title-util'
import { constant as sharedConstant } from '#src/shared/util/constant'
import { errorUtil } from '#src/shared/util/error-util'

const resolveStatusDotTitle = (params: { statusDot?: MenuStatusDotMapper }): string | undefined => {
  const { statusDot } = params
  if (statusDot === undefined) {
    return undefined
  }

  switch (statusDot) {
    case MenuStatusDotMapper.PEAK: {
      return constant.menuStatusDot.peakTitle
    }

    case MenuStatusDotMapper.WARNING: {
      return constant.menuStatusDot.warningTitle
    }

    case MenuStatusDotMapper.ERROR: {
      return undefined
    }

    case MenuStatusDotMapper.WAITING: {
      return undefined
    }

    default: {
      throw typeUtil.exhaustiveError('unsupported menu status dot [statusDot]', statusDot)
    }
  }
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
  [AppViewIdMapper.MOBILE]: (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <rect height="18" rx="2" width="12" x="6" y="3" />
      <line x1="10" x2="14" y1="18" y2="18" />
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
  isMobileServerLive: boolean
  isSchedulingLive: boolean
  isSessionsLive: boolean
  isUsageLive: boolean
  sessionsStatusDot: MenuStatusDotMapper | undefined
  usageActivityStatusDot: MenuStatusDotMapper | undefined
}): SideMenuItem<AppViewIdMapper>[] => {
  const {
    dashboardStatusDot,
    isMobileServerLive,
    isSchedulingLive,
    isSessionsLive,
    isUsageLive,
    sessionsStatusDot,
    usageActivityStatusDot,
  } = params

  return [
    {
      icon: MENU_ICONS[AppViewIdMapper.DASHBOARD],
      id: AppViewIdMapper.DASHBOARD,
      label: 'Dashboard',
      statusDot: dashboardStatusDot,
      statusDotTitle: resolveStatusDotTitle({ statusDot: dashboardStatusDot }),
    },
    {
      icon: MENU_ICONS[AppViewIdMapper.SESSIONS],
      id: AppViewIdMapper.SESSIONS,
      isLive: isSessionsLive,
      label: 'Sessions',
      statusDot: sessionsStatusDot,
    },
    {
      icon: MENU_ICONS[AppViewIdMapper.USAGE],
      id: AppViewIdMapper.USAGE,
      isLive: isUsageLive,
      label: 'Usage',
      statusDot: usageActivityStatusDot,
      statusDotTitle: resolveStatusDotTitle({ statusDot: usageActivityStatusDot }),
    },
    {
      icon: MENU_ICONS[AppViewIdMapper.SCHEDULING],
      id: AppViewIdMapper.SCHEDULING,
      isLive: isSchedulingLive,
      label: 'Scheduling',
    },
    {
      icon: MENU_ICONS[AppViewIdMapper.MOBILE],
      id: AppViewIdMapper.MOBILE,
      isLive: isMobileServerLive,
      label: 'Mobile',
    },
  ]
}

const resolveFooterMenuItems = (params: {
  developmentStatusDot: MenuStatusDotMapper | undefined
  isDevelopmentUnlocked: boolean
}): SideMenuItem<AppViewIdMapper>[] => {
  const { developmentStatusDot, isDevelopmentUnlocked } = params
  const footerMenuItems: SideMenuItem<AppViewIdMapper>[] = [
    { icon: MENU_ICONS[AppViewIdMapper.ABOUT], id: AppViewIdMapper.ABOUT, label: 'About' },
  ]

  if (!isDevelopmentUnlocked) {
    return footerMenuItems
  }

  return [
    ...footerMenuItems,
    {
      icon: MENU_ICONS[AppViewIdMapper.DEVELOPMENT],
      id: AppViewIdMapper.DEVELOPMENT,
      label: 'Development',
      statusDot: developmentStatusDot,
    },
  ]
}

const isUsageLive = (params: { settings?: SettingsModel }): boolean => {
  const { settings } = params
  const trackers = settings?.trackers ?? []

  return trackers.some((tracker) => {
    return !tracker.isAutoRefreshPaused
  })
}

const isSchedulingLive = (params: { settings?: SettingsModel }): boolean => {
  const { settings } = params

  return settings?.isSchedulingEnabled ?? false
}

const isSessionsLive = (params: { settings?: SettingsModel }): boolean => {
  const { settings } = params

  return settings !== undefined && !settings.isSessionsAutoRefreshPaused
}

const isMobileServerLive = (params: { settings?: SettingsModel }): boolean => {
  const { settings } = params

  return settings?.isMobileServerEnabled ?? false
}

export const AppShell = (): ReactElement => {
  const [activeViewId, setActiveViewId] = useState<AppViewIdMapper>(AppViewIdMapper.DASHBOARD)
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(constant.development.defaultElapsedMinutes)
  const [finishedAtBySessionId, setFinishedAtBySessionId] = useState<Record<string, number>>({})
  const [isCollapsed, setIsCollapsed] = useState<boolean>(sideMenuPrefsUtil.loadIsCollapsed)
  const [isDevelopmentUnlocked, setIsDevelopmentUnlocked] = useState<boolean>(developmentPrefsUtil.loadIsUnlocked)
  const [nowMs, setNowMs] = useState<number>((): number => {
    return Date.now()
  })
  const [sessionSnapshot, setSessionSnapshot] = useState<SessionSnapshot | undefined>(undefined)
  const [sessionsErrorMessage, setSessionsErrorMessage] = useState('')
  const [settings, setSettings] = useState<SettingsModel | undefined>(undefined)
  const [usageSnapshot, setUsageSnapshot] = useState<UsageSnapshot | undefined>(undefined)
  const [usedPercent, setUsedPercent] = useState<number>(constant.development.defaultUsedPercent)
  const previousSessionsRef = useRef<SessionInfo[] | undefined>(undefined)
  const settingsRef = useRef<SettingsModel | undefined>(undefined)

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
      const { nextSnapshot, previousSessions } = params
      const sessionSoundService = new SessionSoundService()
      const newlyFinishedSessionIds = sessionStatusTransitionService.resolveStatusTransitionSessionIds({
        currentSessions: nextSnapshot.sessions,
        fromStatus: SessionStatusMapper.BUSY,
        previousSessions,
        toStatus: SessionStatusMapper.IDLE,
      })
      const newlyWaitingSessionIds = sessionStatusTransitionService.resolveNewlyStatusSessionIds({
        currentSessions: nextSnapshot.sessions,
        previousSessions,
        status: SessionStatusMapper.WAITING,
      })
      const soundVolumePercent = settingsRef.current?.soundVolumePercent ?? sharedConstant.soundVolume.defaultPercent

      if (newlyWaitingSessionIds.length > 0) {
        sessionSoundService.playSessionSound({
          soundId: settingsRef.current?.waitingSoundId ?? sharedConstant.waitingSound.defaultId,
          volumePercent: soundVolumePercent,
        })
      }

      if (newlyFinishedSessionIds.length > 0) {
        sessionSoundService.playSessionSound({
          soundId: settingsRef.current?.sessionFinishedSoundId ?? sharedConstant.sessionFinishedSound.defaultId,
          volumePercent: soundVolumePercent,
        })
      }
    }

    const trackFinishedSessions = (params: {
      nextSnapshot: SessionSnapshot
      previousSessions?: SessionInfo[]
    }): void => {
      const { nextSnapshot, previousSessions } = params
      setFinishedAtBySessionId((currentFinishedAtBySessionId) => {
        return sessionFinishedPulseService.resolveFinishedAtBySessionId({
          currentSessions: nextSnapshot.sessions,
          finishedAtBySessionId: currentFinishedAtBySessionId,
          nowMs: Date.now(),
          previousSessions,
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
    }, constant.ui.nowTickIntervalMs)

    return () => {
      clearInterval(tickIntervalId)
    }
  }, [])

  const finishedPulseMs = settings?.sessionFinishedPulseMs ?? sharedConstant.sessionFinishedPulse.defaultMs
  const menuStatusService = new MenuStatusService()
  const refreshIntervalMsByTrackerId = new UsageStalenessService().resolveRefreshIntervalMsByTrackerId({
    trackers: settings?.trackers ?? [],
  })
  const peakStatusDot = menuStatusService.resolvePeakStatusDot({ now: nowMs, snapshot: usageSnapshot })
  const sessionsStatusDot = menuStatusService.resolveSessionsStatusDot({
    hasLoadError: sessionsErrorMessage !== '',
    snapshot: sessionSnapshot,
  })
  const staleStatusDot = menuStatusService.resolveStaleStatusDot({
    now: nowMs,
    refreshIntervalMsByTrackerId,
    snapshot: usageSnapshot,
  })
  const usageActivityStatusDot = menuStatusService.resolveCombinedStatusDot({
    dots: [
      menuStatusService.resolveUsageActivityStatusDot({ now: nowMs, snapshot: usageSnapshot }),
      peakStatusDot,
      staleStatusDot,
    ],
  })
  const dashboardStatusDot = menuStatusService.resolveCombinedStatusDot({
    dots: [usageActivityStatusDot, sessionsStatusDot],
  })
  const developmentStatusDot = menuStatusService.resolveDevelopmentStatusDot({
    elapsedMinutes,
    now: nowMs,
    usedPercent,
  })
  const menuItems = resolveMenuItems({
    dashboardStatusDot,
    isMobileServerLive: isMobileServerLive({ settings }),
    isSchedulingLive: isSchedulingLive({ settings }),
    isSessionsLive: isSessionsLive({ settings }),
    isUsageLive: isUsageLive({ settings }),
    sessionsStatusDot,
    usageActivityStatusDot,
  })
  const footerMenuItems = resolveFooterMenuItems({
    developmentStatusDot,
    isDevelopmentUnlocked,
  })
  const brandStatusDot = menuStatusService.resolveCombinedStatusDot({
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

      case AppViewIdMapper.MOBILE: {
        return <MobilePage />
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
        throw typeUtil.exhaustiveError('unsupported view [activeViewId]', activeViewId)
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
        title={appTitleUtil.resolve({ isDev: import.meta.env.DEV })}
      />
      <div className="app-shell-main">
        <div className="app-shell-content">{renderActiveView()}</div>
        <AppShellFooter />
      </div>
    </div>
  )
}
