import { type UsageSnapshotRepo } from '#src/main/business/repo/usage-snapshot-repo'
import { ClaudeSystemTokenService } from '#src/main/business/service/claude-system-token-service'
import { UsageProviderClaude } from '#src/main/business/service/usage-provider/claude'
import { UsageProviderDummy } from '#src/main/business/service/usage-provider/dummy'
import { type UsageProvider } from '#src/main/business/service/usage-provider/usage-provider'
import { UsageProviderZai } from '#src/main/business/service/usage-provider/zai'
import { errorUtil } from '#src/main/util/error-util'
import { ClaudeTokenSource } from '#src/shared/business/enum/claude-token-source-enum'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { UsageStatus } from '#src/shared/business/enum/usage-status-enum'
import { type AppSettings, type TrackerConfig } from '#src/shared/business/model/settings-model'
import {
  type ProviderSnapshot,
  type UsageSnapshot,
  type UsageUpdateListener,
} from '#src/shared/business/model/usage-model'

export class UsagePollService {
  protected _generationByTrackerId = new Map<string, number>()
  protected _isWindowVisible = false
  protected _listeners: UsageUpdateListener[] = []
  protected _nextPollAtByTrackerId = new Map<string, number>()
  protected _settings: AppSettings | undefined
  protected _snapshotByTrackerId = new Map<string, ProviderSnapshot>()
  protected _timerByTrackerId = new Map<string, NodeJS.Timeout>()
  protected readonly _claudeSystemTokenService: ClaudeSystemTokenService
  protected readonly _providers: Record<ProviderIdMapper, UsageProvider>
  protected readonly _snapshotRepo?: UsageSnapshotRepo

  constructor(params?: {
    claudeSystemTokenService?: ClaudeSystemTokenService
    providers?: Record<ProviderIdMapper, UsageProvider>
    snapshotRepo?: UsageSnapshotRepo
  }) {
    const {
      claudeSystemTokenService = new ClaudeSystemTokenService(),
      providers = this._createDefaultProviders(),
      snapshotRepo,
    } = params ?? {}

    this._claudeSystemTokenService = claudeSystemTokenService
    this._providers = providers
    this._snapshotRepo = snapshotRepo
  }

  async start(params: { settings: AppSettings }): Promise<void> {
    this._settings = params.settings

    await this._hydratePersistedSnapshots()

    if (!this._isWindowVisible) {
      return
    }

    await this._resumeTrackers()
  }

  async restart(params: { settings: AppSettings }): Promise<void> {
    this.stop()
    this._settings = params.settings
    await this.refreshNow()
  }

  stop(): void {
    this._timerByTrackerId.forEach((timer) => {
      clearTimeout(timer)
    })
    this._timerByTrackerId.clear()
  }

  setWindowVisibility(params: { isVisible: boolean }): void {
    if (params.isVisible === this._isWindowVisible) {
      return
    }

    this._isWindowVisible = params.isVisible

    if (!params.isVisible) {
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
    const tracker = this._resolveTracker({ trackerId: params.trackerId })

    if (tracker === undefined) {
      return
    }

    this._cancelTrackerTimer({ trackerId: tracker.id })

    const isPollApplied = await this._pollTrackerOnce({ tracker })

    this._rescheduleTrackerAfterPoll({ isPollApplied, trackerId: tracker.id })
  }

  async applyTrackerAutoRefresh(params: { settings: AppSettings; trackerId: string }): Promise<void> {
    this._settings = params.settings

    const tracker = this._resolveTracker({ trackerId: params.trackerId })

    if (tracker === undefined) {
      return
    }

    if (tracker.isAutoRefreshPaused) {
      this._cancelTrackerTimer({ trackerId: tracker.id })
      this._notifyListeners({ snapshot: this._buildSnapshot() })

      return
    }

    await this.refreshTracker({ trackerId: tracker.id })
  }

  getSnapshot(): UsageSnapshot {
    return this._buildSnapshot()
  }

  onUpdate(params: { listener: UsageUpdateListener }): () => void {
    this._listeners.push(params.listener)

    return () => {
      this._listeners = this._listeners.filter((listener) => {
        return listener !== params.listener
      })
    }
  }

  protected _createDefaultProviders(): Record<ProviderIdMapper, UsageProvider> {
    return {
      [ProviderIdMapper.CLAUDE]: new UsageProviderClaude(),
      [ProviderIdMapper.DUMMY]: new UsageProviderDummy(),
      [ProviderIdMapper.ZAI]: new UsageProviderZai(),
    }
  }

  protected _resolveTracker(params: { trackerId: string }): TrackerConfig | undefined {
    const settings = this._settings

    if (settings === undefined) {
      return undefined
    }

    return settings.trackers.find((tracker) => {
      return tracker.id === params.trackerId
    })
  }

  protected async _pollTrackerOnce(params: { tracker: TrackerConfig }): Promise<boolean> {
    const generation = this._beginTrackerPoll({ trackerId: params.tracker.id })
    this._notifyListeners({ snapshot: this._buildSnapshot() })

    const providerSnapshot = await this._pollTracker({ tracker: params.tracker })

    if (generation !== this._generationByTrackerId.get(params.tracker.id)) {
      return false
    }

    this._snapshotByTrackerId.set(params.tracker.id, providerSnapshot)
    this._persistSnapshots()
    this._notifyListeners({ snapshot: this._buildSnapshot() })

    return true
  }

  protected _beginTrackerPoll(params: { trackerId: string }): number {
    const nextGeneration = (this._generationByTrackerId.get(params.trackerId) ?? 0) + 1
    this._generationByTrackerId.set(params.trackerId, nextGeneration)

    return nextGeneration
  }

  protected _buildPersistedSnapshotsByTrackerId(): Record<string, ProviderSnapshot> {
    const settings = this._settings

    if (settings === undefined) {
      return {}
    }

    return settings.trackers.reduce<Record<string, ProviderSnapshot>>((snapshotsByTrackerId, tracker) => {
      const snapshot = this._snapshotByTrackerId.get(tracker.id)
      const isPersistable = tracker.providerId !== ProviderIdMapper.DUMMY

      if (isPersistable && snapshot?.status === UsageStatus.OK) {
        snapshotsByTrackerId[tracker.id] = {
          fetchedAt: snapshot.fetchedAt,
          providerId: snapshot.providerId,
          status: UsageStatus.OK,
          trackerId: snapshot.trackerId,
          trackerName: snapshot.trackerName,
          usage: snapshot.usage,
        }
      }

      return snapshotsByTrackerId
    }, {})
  }

  protected async _hydratePersistedSnapshots(): Promise<void> {
    const snapshotRepo = this._snapshotRepo

    if (snapshotRepo === undefined) {
      return
    }

    const persistedSnapshotsByTrackerId = await snapshotRepo.load()
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
    if (params.tracker.isAutoRefreshPaused) {
      return
    }

    const resumeDelayMs = this._calcResumeDelayMs({ tracker: params.tracker })

    if (resumeDelayMs > 0) {
      this._scheduleTracker({ delayMs: resumeDelayMs, tracker: params.tracker })

      return
    }

    await this.refreshTracker({ trackerId: params.tracker.id })
  }

  protected _calcResumeDelayMs(params: { tracker: TrackerConfig }): number {
    const snapshot = this._snapshotByTrackerId.get(params.tracker.id)

    if (snapshot?.fetchedAt === undefined) {
      return 0
    }

    const nextPollAt = snapshot.fetchedAt + params.tracker.refreshIntervalMs
    const resumeDelayMs = nextPollAt - Date.now()

    if (resumeDelayMs <= 0) {
      return 0
    }

    return resumeDelayMs
  }

  protected _persistSnapshots(): void {
    const snapshotRepo = this._snapshotRepo

    if (snapshotRepo === undefined) {
      return
    }

    void snapshotRepo.save({ snapshotsByTrackerId: this._buildPersistedSnapshotsByTrackerId() }).catch(() => {
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
    const nextRefreshAt = this._resolveTrackerNextRefreshAt({ tracker: params.tracker })
    const existingSnapshot = this._snapshotByTrackerId.get(params.tracker.id)

    if (existingSnapshot !== undefined) {
      return {
        ...existingSnapshot,
        nextRefreshAt,
      }
    }

    return {
      nextRefreshAt,
      providerId: params.tracker.providerId,
      status: UsageStatus.PENDING,
      trackerId: params.tracker.id,
      trackerName: params.tracker.name,
    }
  }

  protected _resolveTrackerNextRefreshAt(params: { tracker: TrackerConfig }): number | undefined {
    if (params.tracker.isAutoRefreshPaused) {
      return undefined
    }

    return this._nextPollAtByTrackerId.get(params.tracker.id)
  }

  protected async _pollTracker(params: { tracker: TrackerConfig }): Promise<ProviderSnapshot> {
    const tracker = params.tracker
    const provider = this._providers[tracker.providerId]

    try {
      const accessToken = await this._resolveAccessToken({ tracker })
      const isAccessTokenRequired = tracker.providerId !== ProviderIdMapper.DUMMY

      if (isAccessTokenRequired && accessToken === '') {
        return {
          providerId: tracker.providerId,
          status: UsageStatus.UNCONFIGURED,
          trackerId: tracker.id,
          trackerName: tracker.name,
        }
      }

      const usage = await provider.fetchUsage({ accessToken })

      return {
        fetchedAt: Date.now(),
        providerId: tracker.providerId,
        status: UsageStatus.OK,
        trackerId: tracker.id,
        trackerName: tracker.name,
        usage,
      }
    } catch (error) {
      return {
        errorMessage: errorUtil.resolveMessage(error),
        providerId: tracker.providerId,
        status: UsageStatus.ERROR,
        trackerId: tracker.id,
        trackerName: tracker.name,
      }
    }
  }

  protected async _resolveAccessToken(params: { tracker: TrackerConfig }): Promise<string> {
    if (
      params.tracker.providerId === ProviderIdMapper.CLAUDE &&
      params.tracker.tokenSource === ClaudeTokenSource.SYSTEM
    ) {
      return await this._claudeSystemTokenService.resolveAccessToken()
    }

    return params.tracker.accessToken
  }

  protected _rescheduleTrackerAfterPoll(params: { isPollApplied: boolean; trackerId: string }): void {
    if (!params.isPollApplied) {
      return
    }

    if (!this._isWindowVisible) {
      return
    }

    const tracker = this._resolveTracker({ trackerId: params.trackerId })

    if (tracker === undefined || tracker.isAutoRefreshPaused) {
      return
    }

    this._scheduleTracker({ delayMs: tracker.refreshIntervalMs, tracker })
  }

  protected _scheduleTracker(params: { delayMs: number; tracker: TrackerConfig }): void {
    this._cancelTrackerTimer({ trackerId: params.tracker.id })

    const nextPollAt = Date.now() + params.delayMs
    this._nextPollAtByTrackerId.set(params.tracker.id, nextPollAt)

    const timer = setTimeout(() => {
      void this._onTrackerTimer({ tracker: params.tracker })
    }, params.delayMs)

    this._timerByTrackerId.set(params.tracker.id, timer)
  }

  protected async _onTrackerTimer(params: { tracker: TrackerConfig }): Promise<void> {
    const isPollApplied = await this._pollTrackerOnce({ tracker: params.tracker })

    this._rescheduleTrackerAfterPoll({ isPollApplied, trackerId: params.tracker.id })
  }

  protected _cancelTrackerTimer(params: { trackerId: string }): void {
    const timer = this._timerByTrackerId.get(params.trackerId)

    if (timer === undefined) {
      return
    }

    clearTimeout(timer)
    this._timerByTrackerId.delete(params.trackerId)
  }

  protected _notifyListeners(params: { snapshot: UsageSnapshot }): void {
    this._listeners.forEach((listener) => {
      listener(params.snapshot)
    })
  }
}
