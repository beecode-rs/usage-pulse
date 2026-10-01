import { singletonPattern } from '@beecode/msh-util'

import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { appEventBusSingleton } from '#src/main/lib/app-event-bus-singleton'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { UsageActivityStatus } from '#src/shared/business/enum/usage-activity-status-enum'
import { UsageSeverityLevel } from '#src/shared/business/enum/usage-severity-level-enum'
import { type UsageWarning, UsageWarningReason } from '#src/shared/business/model/mobile-api-model'
import { type SessionInfo, type SessionSnapshot } from '#src/shared/business/model/session-model'
import { type ProviderSnapshot, type UsageSnapshot } from '#src/shared/business/model/usage-model'
import { sessionStatusTransitionUtil } from '#src/shared/util/session-status-transition-util'
import { usageSeverityLevelUtil } from '#src/shared/util/usage-severity-level-util'

const SEVERITY_LEVEL_RANK: Record<UsageSeverityLevel, number> = {
  [UsageSeverityLevel.FILLING_UP]: 1,
  [UsageSeverityLevel.HIGH_USAGE]: 2,
  [UsageSeverityLevel.LIMIT_REACHED]: 3,
  [UsageSeverityLevel.NONE]: 0,
}

export class _MobileDerivedEventsService {
  protected _previousSessionsSnapshot: SessionSnapshot | undefined
  protected _previousSeverityByWindowKey = new Map<string, UsageSeverityLevel>()
  protected _previousStatusByTrackerId = new Map<string, UsageActivityStatus>()
  protected _subscriptions: { unsubscribe: () => void }[] = []

  start(): void {
    this.stop()
    this._subscriptions = [
      appEventBusSingleton().subscribe({
        listener: (snapshot) => {
          this._onSessionsSnapshot({ snapshot })
        },
        type: AppEventType.SESSIONS_SNAPSHOT,
      }),
      appEventBusSingleton().subscribe({
        listener: (snapshot) => {
          this._onUsageSnapshot({ snapshot })
        },
        type: AppEventType.USAGE_SNAPSHOT,
      }),
    ]
  }

  stop(): void {
    this._subscriptions.forEach((subscription) => {
      subscription.unsubscribe()
    })
    this._subscriptions = []
    this._previousSessionsSnapshot = undefined
    this._previousSeverityByWindowKey = new Map()
    this._previousStatusByTrackerId = new Map()
  }

  protected _onSessionsSnapshot(params: { snapshot: SessionSnapshot }): void {
    const { snapshot } = params
    const previousSessions = this._previousSessionsSnapshot?.sessions
    const finishedSessionIds = this._resolveFinishedSessionIds({ currentSessions: snapshot.sessions, previousSessions })
    const newlyWaitingSessionIds = sessionStatusTransitionUtil.resolveNewlyStatusSessionIds({
      currentSessions: snapshot.sessions,
      previousSessions,
      status: SessionStatusMapper.WAITING,
    })

    this._previousSessionsSnapshot = snapshot

    this._emitSessionEvents({
      sessionIds: finishedSessionIds,
      sessions: snapshot.sessions,
      type: AppEventType.SESSION_FINISHED,
    })
    this._emitSessionEvents({
      sessionIds: newlyWaitingSessionIds,
      sessions: snapshot.sessions,
      type: AppEventType.SESSION_WAITING,
    })
  }

  protected _resolveFinishedSessionIds(params: {
    currentSessions: SessionInfo[]
    previousSessions?: SessionInfo[]
  }): string[] {
    const { currentSessions, previousSessions } = params
    const busyToIdleSessionIds = sessionStatusTransitionUtil.resolveStatusTransitionSessionIds({
      currentSessions,
      fromStatus: SessionStatusMapper.BUSY,
      previousSessions,
      toStatus: SessionStatusMapper.IDLE,
    })
    const waitingToIdleSessionIds = sessionStatusTransitionUtil.resolveStatusTransitionSessionIds({
      currentSessions,
      fromStatus: SessionStatusMapper.WAITING,
      previousSessions,
      toStatus: SessionStatusMapper.IDLE,
    })

    return [...new Set([...busyToIdleSessionIds, ...waitingToIdleSessionIds])]
  }

  protected _emitSessionEvents(params: {
    sessionIds: string[]
    sessions: SessionInfo[]
    type: AppEventType.SESSION_FINISHED | AppEventType.SESSION_WAITING
  }): void {
    const { sessionIds, sessions, type } = params
    sessionIds.forEach((sessionId) => {
      const session = sessions.find((candidate) => {
        return candidate.sessionId === sessionId
      })

      if (session === undefined) {
        return
      }

      appEventBusSingleton().emit({ payload: session, type })
    })
  }

  protected _onUsageSnapshot(params: { snapshot: UsageSnapshot }): void {
    const { snapshot } = params
    snapshot.providers.forEach((provider) => {
      this._processProviderErrorTransition({ provider })
      this._processProviderWindowLevels({ provider })
    })
  }

  protected _processProviderErrorTransition(params: { provider: ProviderSnapshot }): void {
    const { provider } = params
    const previousStatus = this._previousStatusByTrackerId.get(provider.trackerId)

    this._previousStatusByTrackerId.set(provider.trackerId, provider.status)

    if (provider.status !== UsageActivityStatus.ERROR) {
      return
    }

    if (previousStatus === undefined || previousStatus === UsageActivityStatus.ERROR) {
      return
    }

    const warning: UsageWarning = {
      reason: UsageWarningReason.PROVIDER_ERROR,
      trackerId: provider.trackerId,
      trackerName: provider.trackerName,
    }

    if (provider.errorMessage !== undefined) {
      warning.errorMessage = provider.errorMessage
    }

    appEventBusSingleton().emit({ payload: warning, type: AppEventType.USAGE_WARNING })
  }

  protected _processProviderWindowLevels(params: { provider: ProviderSnapshot }): void {
    const { provider } = params
    const usageWindows = provider.usage ?? []

    usageWindows.forEach((window) => {
      const level = usageSeverityLevelUtil.resolveSeverityLevel({ usedPercent: window.usedPercent })
      const previousLevel = this._previousSeverityByWindowKey.get(`${provider.trackerId}:${window.label}`)

      this._previousSeverityByWindowKey.set(`${provider.trackerId}:${window.label}`, level)

      if (previousLevel === undefined || SEVERITY_LEVEL_RANK[level] <= SEVERITY_LEVEL_RANK[previousLevel]) {
        return
      }

      if (level !== UsageSeverityLevel.HIGH_USAGE && level !== UsageSeverityLevel.LIMIT_REACHED) {
        return
      }

      appEventBusSingleton().emit({
        payload: {
          reason: this._resolvePercentWarningReason({ level }),
          trackerId: provider.trackerId,
          trackerName: provider.trackerName,
          usedPercent: window.usedPercent,
          windowLabel: window.label,
        },
        type: AppEventType.USAGE_WARNING,
      })
    })
  }

  protected _resolvePercentWarningReason(params: { level: UsageSeverityLevel }): UsageWarningReason {
    const { level } = params
    if (level === UsageSeverityLevel.LIMIT_REACHED) {
      return UsageWarningReason.LIMIT_REACHED
    }

    return UsageWarningReason.HIGH_USAGE
  }
}

export const mobileDerivedEventsServiceSingleton = singletonPattern(() => {
  return new _MobileDerivedEventsService()
})
