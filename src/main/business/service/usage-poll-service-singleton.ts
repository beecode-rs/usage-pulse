import { singletonPattern } from '@beecode/msh-util'

import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { UsageSnapshotRepo } from '#src/main/business/repo/usage-snapshot-repo'
import { appEventBusSingleton } from '#src/main/business/service/app-event-bus-singleton'
import { ClaudeSystemAccessTokenService } from '#src/main/business/service/claude-system-access-token-service'
import { UsageProviderClaude } from '#src/main/business/service/usage-provider/claude'
import { type UsageProvider } from '#src/main/business/service/usage-provider/usage-provider'
import { UsageProviderZai } from '#src/main/business/service/usage-provider/zai'
import { errorUtil } from '#src/main/util/error-util'
import { ClaudeAccessTokenSource } from '#src/shared/business/enum/claude-access-token-source-enum'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { UsageActivityStatus } from '#src/shared/business/enum/usage-activity-status-enum'
import { type SettingsModel, type TrackerConfig } from '#src/shared/business/model/settings-model'
import { type ProviderSnapshot, type UsageSnapshot } from '#src/shared/business/model/usage-model'

export class _UsagePollService {
  protected _generationByTrackerId = new Map<string, number>()
  protected _isWindowVisible = false
  protected _nextPollAtByTrackerId = new Map<string, number>()
  protected _settings: SettingsModel | undefined
  protected _snapshotByTrackerId = new Map<string, ProviderSnapshot>()
  protected _timerByTrackerId = new Map<string, NodeJS.Timeout>()
  protected readonly _claudeSystemAccessTokenService = new ClaudeSystemAccessTokenService()
  protected readonly _providers: Record<ProviderIdMapper, UsageProvider> = {
    [ProviderIdMapper.CLAUDE]: new UsageProviderClaude(),
    [ProviderIdMapper.ZAI]: new UsageProviderZai(),
  }

  protected readonly _settingsRepo = settingsRepoSingleton()
  protected readonly _settingsSavedSubscription = appEventBusSingleton().subscribe({
    listener: () => {
      void this.restart().catch(() => {
        return undefined
      })
    },
    type: AppEventType.SETTINGS_SAVED,
  })

  protected readonly _snapshotRepo = new UsageSnapshotRepo()

  async start(): Promise<void> {
    this._settings = this._settingsRepo.fetch()

    await this._hydratePersistedSnapshots()

    if (!this._isWindowVisible) {
      return
    }

    await this._resumeTrackers()
  }

  async restart(): Promise<void> {
    this.stop()
    this._settings = this._settingsRepo.fetch()
    await this.refreshNow()
  }

  stop(): void {
    this._timerByTrackerId.forEach((timer) => {
      clearTimeout(timer)
    })
    this._timerByTrackerId.clear()
  }

  setWindowVisibility(params: { isVisible: boolean }): void {
    const { isVisible } = params
    if (isVisible === this._isWindowVisible) {
      return
    }

    this._isWindowVisible = isVisible

    if (!isVisible) {
      this.stop()

      return
    }

    void this._resumeTrackers()
  }

  async refreshNow(): Promise<void> {
    const settings = this._settings

    if (settings === undefined) {
      return
    }

    await Promise.all(
      settings.trackers
        .filter((tracker) => {
          return !tracker.isAutoRefreshPaused
        })
        .map((tracker) => {
          return this.refreshTracker({ trackerId: tracker.id })
        }),
    )
  }

  async refreshTracker(params: { trackerId: string }): Promise<void> {
    const { trackerId } = params
    const tracker = this._resolveTracker({ trackerId })

    if (tracker === undefined) {
      return
    }

    this._cancelTrackerTimer({ trackerId: tracker.id })

    const isPollApplied = await this._pollTrackerOnce({ tracker })

    this._rescheduleTrackerAfterPoll({ isPollApplied, trackerId: tracker.id })
  }

  getSnapshot(): UsageSnapshot {
    return this._buildSnapshot()
  }

  protected _resolveTracker(params: { trackerId: string }): TrackerConfig | undefined {
    const { trackerId } = params
    const settings = this._settings

    if (settings === undefined) {
      return undefined
    }

    return settings.trackers.find((tracker) => {
      return tracker.id === trackerId
    })
  }

  protected async _pollTrackerOnce(params: { tracker: TrackerConfig }): Promise<boolean> {
    const { tracker } = params
    const generation = this._beginTrackerPoll({ trackerId: tracker.id })
    appEventBusSingleton().emit({ payload: this._buildSnapshot(), type: AppEventType.USAGE_SNAPSHOT })

    const providerSnapshot = await this._pollTracker({ tracker })

    if (generation !== this._generationByTrackerId.get(tracker.id)) {
      return false
    }

    this._snapshotByTrackerId.set(tracker.id, providerSnapshot)
    this._persistSnapshots()
    appEventBusSingleton().emit({ payload: this._buildSnapshot(), type: AppEventType.USAGE_SNAPSHOT })

    return true
  }

  protected _beginTrackerPoll(params: { trackerId: string }): number {
    const { trackerId } = params
    const nextGeneration = (this._generationByTrackerId.get(trackerId) ?? 0) + 1
    this._generationByTrackerId.set(trackerId, nextGeneration)

    return nextGeneration
  }

  protected _buildPersistedSnapshotsByTrackerId(): Record<string, ProviderSnapshot> {
    const settings = this._settings

    if (settings === undefined) {
      return {}
    }

    return settings.trackers.reduce<Record<string, ProviderSnapshot>>((snapshotsByTrackerId, tracker) => {
      const snapshot = this._snapshotByTrackerId.get(tracker.id)

      if (snapshot?.status === UsageActivityStatus.OK) {
        snapshotsByTrackerId[tracker.id] = {
          fetchedAt: snapshot.fetchedAt,
          providerId: snapshot.providerId,
          status: UsageActivityStatus.OK,
          trackerId: snapshot.trackerId,
          trackerName: snapshot.trackerName,
          usage: snapshot.usage,
        }
      }

      return snapshotsByTrackerId
    }, {})
  }

  protected async _hydratePersistedSnapshots(): Promise<void> {
    const persistedSnapshotsByTrackerId = await this._snapshotRepo.load()
    const settings = this._settings

    if (settings === undefined) {
      return
    }

    settings.trackers.forEach((tracker) => {
      const persistedSnapshot = persistedSnapshotsByTrackerId[tracker.id]

      if (persistedSnapshot !== undefined) {
        this._snapshotByTrackerId.set(tracker.id, persistedSnapshot)
      }
    })
  }

  protected async _resumeTrackers(): Promise<void> {
    const settings = this._settings

    if (settings === undefined) {
      return
    }

    await Promise.all(
      settings.trackers.map((tracker) => {
        return this._resumeTracker({ tracker })
      }),
    )
  }

  protected async _resumeTracker(params: { tracker: TrackerConfig }): Promise<void> {
    const { tracker } = params
    if (tracker.isAutoRefreshPaused) {
      return
    }

    const resumeDelayMs = this._calcResumeDelayMs({ tracker })

    if (resumeDelayMs > 0) {
      this._scheduleTracker({ delayMs: resumeDelayMs, tracker })

      return
    }

    await this.refreshTracker({ trackerId: tracker.id })
  }

  protected _calcResumeDelayMs(params: { tracker: TrackerConfig }): number {
    const { tracker } = params
    const snapshot = this._snapshotByTrackerId.get(tracker.id)

    if (snapshot?.fetchedAt === undefined) {
      return 0
    }

    const nextPollAt = snapshot.fetchedAt + tracker.refreshIntervalMs
    const resumeDelayMs = nextPollAt - Date.now()

    if (resumeDelayMs <= 0) {
      return 0
    }

    return resumeDelayMs
  }

  protected _persistSnapshots(): void {
    void this._snapshotRepo.save({ snapshotsByTrackerId: this._buildPersistedSnapshotsByTrackerId() }).catch(() => {
      return undefined
    })
  }

  protected _buildSnapshot(): UsageSnapshot {
    const settings = this._settings

    if (settings === undefined) {
      return { providers: [] }
    }

    return {
      providers: settings.trackers.map((tracker) => {
        return this._resolveTrackerSnapshot({ tracker })
      }),
    }
  }

  protected _resolveTrackerSnapshot(params: { tracker: TrackerConfig }): ProviderSnapshot {
    const { tracker } = params
    const nextRefreshAt = this._resolveTrackerNextRefreshAt({ tracker })
    const existingSnapshot = this._snapshotByTrackerId.get(tracker.id)

    if (existingSnapshot !== undefined) {
      return {
        ...existingSnapshot,
        nextRefreshAt,
      }
    }

    return {
      nextRefreshAt,
      providerId: tracker.providerId,
      status: UsageActivityStatus.PENDING,
      trackerId: tracker.id,
      trackerName: tracker.name,
    }
  }

  protected _resolveTrackerNextRefreshAt(params: { tracker: TrackerConfig }): number | undefined {
    const { tracker } = params
    if (tracker.isAutoRefreshPaused) {
      return undefined
    }

    return this._nextPollAtByTrackerId.get(tracker.id)
  }

  protected async _pollTracker(params: { tracker: TrackerConfig }): Promise<ProviderSnapshot> {
    const { tracker } = params
    const provider = this._providers[tracker.providerId]

    try {
      const accessToken = await this._resolveAccessToken({ tracker })

      if (accessToken === '') {
        return {
          providerId: tracker.providerId,
          status: UsageActivityStatus.UNCONFIGURED,
          trackerId: tracker.id,
          trackerName: tracker.name,
        }
      }

      const usage = await provider.fetchUsage({ accessToken })

      return {
        fetchedAt: Date.now(),
        providerId: tracker.providerId,
        status: UsageActivityStatus.OK,
        trackerId: tracker.id,
        trackerName: tracker.name,
        usage,
      }
    } catch (error) {
      return {
        errorMessage: errorUtil.resolveMessage(error),
        providerId: tracker.providerId,
        status: UsageActivityStatus.ERROR,
        trackerId: tracker.id,
        trackerName: tracker.name,
      }
    }
  }

  protected async _resolveAccessToken(params: { tracker: TrackerConfig }): Promise<string> {
    const { tracker } = params
    if (
      tracker.providerId === ProviderIdMapper.CLAUDE &&
      tracker.accessTokenSource === ClaudeAccessTokenSource.SYSTEM
    ) {
      return await this._claudeSystemAccessTokenService.resolveAccessToken()
    }

    return tracker.accessToken
  }

  protected _rescheduleTrackerAfterPoll(params: { isPollApplied: boolean; trackerId: string }): void {
    const { isPollApplied, trackerId } = params
    if (!isPollApplied) {
      return
    }

    if (!this._isWindowVisible) {
      return
    }

    const tracker = this._resolveTracker({ trackerId })

    if (tracker === undefined || tracker.isAutoRefreshPaused) {
      return
    }

    this._scheduleTracker({ delayMs: tracker.refreshIntervalMs, tracker })
  }

  protected _scheduleTracker(params: { delayMs: number; tracker: TrackerConfig }): void {
    const { delayMs, tracker } = params
    this._cancelTrackerTimer({ trackerId: tracker.id })

    const nextPollAt = Date.now() + delayMs
    this._nextPollAtByTrackerId.set(tracker.id, nextPollAt)

    const timer = setTimeout(() => {
      void this._onTrackerTimer({ tracker })
    }, delayMs)

    this._timerByTrackerId.set(tracker.id, timer)
  }

  protected async _onTrackerTimer(params: { tracker: TrackerConfig }): Promise<void> {
    const { tracker } = params
    const isPollApplied = await this._pollTrackerOnce({ tracker })

    this._rescheduleTrackerAfterPoll({ isPollApplied, trackerId: tracker.id })
  }

  protected _cancelTrackerTimer(params: { trackerId: string }): void {
    const { trackerId } = params
    const timer = this._timerByTrackerId.get(trackerId)

    if (timer === undefined) {
      return
    }

    clearTimeout(timer)
    this._timerByTrackerId.delete(trackerId)
  }
}

export const usagePollServiceSingleton = singletonPattern(() => {
  return new _UsagePollService()
})
