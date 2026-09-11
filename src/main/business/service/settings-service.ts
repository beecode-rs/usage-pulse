import { objectUtil } from '#src/main/util/object-util'
import { ClaudeTokenSource } from '#src/shared/business/enum/claude-token-source-enum'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import type { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'
import { SoundNameMapper } from '#src/shared/business/enum/sound-name-mapper-enum'
import type { ScheduleTriggerConfig } from '#src/shared/business/model/schedule-trigger-model'
import type {
  AppSettings,
  ClaudeTrackerConfig,
  DummyTrackerConfig,
  SshHostConfig,
  TrackerConfig,
  ZaiTrackerConfig,
} from '#src/shared/business/model/settings-model'
import { constant } from '#src/shared/util/constant'

export class SettingsService {
  createDefaultSettings(): AppSettings {
    return {
      isSchedulingEnabled: constant.scheduling.defaultIsEnabled,
      isSessionsAutoRefreshPaused: constant.sessionsAutoRefresh.defaultIsPaused,
      sessionFinishedPulseMs: constant.sessionFinishedPulse.defaultMs,
      sessionFinishedSoundId: constant.sessionFinishedSound.defaultId,
      sessionsRefreshIntervalMs: constant.sessionsRefreshInterval.defaultMs,
      soundVolumePercent: constant.soundVolume.defaultPercent,
      sshHosts: [],
      trackers: [],
      triggers: [],
      waitingSoundId: constant.waitingSound.defaultId,
    }
  }

  sanitizeSettings(params: { rawSettings: unknown }): AppSettings {
    const rawRecord = objectUtil.asRecord(params.rawSettings)

    if (rawRecord === undefined) {
      return this.createDefaultSettings()
    }

    const rawTrackers = rawRecord['trackers']
    const rawTriggers = rawRecord['triggers']

    return {
      isSchedulingEnabled: this._resolveIsSchedulingEnabled({ value: rawRecord['isSchedulingEnabled'] }),
      isSessionsAutoRefreshPaused: this._resolveIsSessionsAutoRefreshPaused({
        value: rawRecord['isSessionsAutoRefreshPaused'],
      }),
      sessionFinishedPulseMs: this._resolveSessionFinishedPulseMs({ rawRecord }),
      sessionFinishedSoundId: this._resolveSessionFinishedSoundId({ rawRecord }),
      sessionsRefreshIntervalMs: this._resolveSessionsRefreshIntervalMs({ rawRecord }),
      soundVolumePercent: this._resolveSoundVolumePercent({ rawRecord }),
      sshHosts: this._resolveSshHosts({ rawSshHosts: rawRecord['sshHosts'] }),
      trackers: this._resolveTrackers({ rawRecord, rawTrackers }),
      triggers: this._resolveTriggers({ rawTriggers }),
      waitingSoundId: this._resolveWaitingSoundId({ rawRecord }),
    }
  }

  setSchedulingEnabled(params: { isEnabled: boolean; settings: AppSettings }): AppSettings {
    return {
      ...params.settings,
      isSchedulingEnabled: params.isEnabled,
    }
  }

  setTrackerPaused(params: { isAutoRefreshPaused: boolean; settings: AppSettings; trackerId: string }): AppSettings {
    return {
      ...params.settings,
      trackers: params.settings.trackers.map((tracker) => {
        if (tracker.id !== params.trackerId) {
          return tracker
        }

        return { ...tracker, isAutoRefreshPaused: params.isAutoRefreshPaused }
      }),
    }
  }

  setTriggerEnabled(params: { isEnabled: boolean; settings: AppSettings; triggerId: string }): AppSettings {
    return {
      ...params.settings,
      triggers: params.settings.triggers.map((trigger) => {
        if (trigger.id !== params.triggerId) {
          return trigger
        }

        return { ...trigger, isEnabled: params.isEnabled }
      }),
    }
  }

  protected _resolveIsSchedulingEnabled(params: { value: unknown }): boolean {
    if (typeof params.value !== 'boolean') {
      return constant.scheduling.defaultIsEnabled
    }

    return params.value
  }

  protected _resolveIsSessionsAutoRefreshPaused(params: { value: unknown }): boolean {
    if (typeof params.value !== 'boolean') {
      return constant.sessionsAutoRefresh.defaultIsPaused
    }

    return params.value
  }

  protected _resolveSessionsRefreshIntervalMs(params: { rawRecord: Record<string, unknown> }): number {
    const intervalMs = this._resolveOptionalMs({
      legacySecondsKey: 'sessionsRefreshIntervalSeconds',
      msKey: 'sessionsRefreshIntervalMs',
      rawRecord: params.rawRecord,
    })

    if (intervalMs === undefined) {
      return constant.sessionsRefreshInterval.defaultMs
    }

    const clampedIntervalMs = Math.min(
      Math.max(intervalMs, constant.sessionsRefreshInterval.minMs),
      constant.sessionsRefreshInterval.maxMs,
    )

    return Math.round(clampedIntervalMs)
  }

  protected _resolveSessionFinishedPulseMs(params: { rawRecord: Record<string, unknown> }): number {
    const pulseMs = this._resolveOptionalMs({
      legacySecondsKey: 'sessionFinishedPulseSeconds',
      msKey: 'sessionFinishedPulseMs',
      rawRecord: params.rawRecord,
    })

    if (pulseMs === undefined) {
      return constant.sessionFinishedPulse.defaultMs
    }

    const clampedPulseMs = Math.min(
      Math.max(pulseMs, constant.sessionFinishedPulse.minMs),
      constant.sessionFinishedPulse.maxMs,
    )

    return Math.round(clampedPulseMs)
  }

  protected _resolveOptionalMs(params: {
    legacySecondsKey: string
    msKey: string
    rawRecord: Record<string, unknown>
  }): number | undefined {
    const msValue = params.rawRecord[params.msKey]

    if (typeof msValue === 'number' && Number.isFinite(msValue)) {
      return msValue
    }

    const legacySecondsValue = params.rawRecord[params.legacySecondsKey]

    if (typeof legacySecondsValue === 'number' && Number.isFinite(legacySecondsValue)) {
      return legacySecondsValue * 1000
    }

    return undefined
  }

  protected _resolveSessionFinishedSoundId(params: { rawRecord: Record<string, unknown> }): SoundNameMapper {
    const soundId = this._resolveOptionalSoundNameMapper({ value: params.rawRecord['sessionFinishedSoundId'] })

    if (soundId !== undefined) {
      return soundId
    }

    const legacySoundId = this._resolveOptionalSoundNameMapper({ value: params.rawRecord['idleSoundId'] })

    if (legacySoundId !== undefined) {
      return legacySoundId
    }

    return constant.sessionFinishedSound.defaultId
  }

  protected _resolveOptionalSoundNameMapper(params: { value: unknown }): SoundNameMapper | undefined {
    return constant.sessionSoundIds.find((candidate) => {
      return candidate === params.value
    })
  }

  protected _resolveWaitingSoundId(params: { rawRecord: Record<string, unknown> }): SoundNameMapper {
    const soundId = this._resolveOptionalSoundNameMapper({ value: params.rawRecord['waitingSoundId'] })

    if (soundId !== undefined) {
      return soundId
    }

    if (params.rawRecord['isWaitingSoundEnabled'] === false) {
      return SoundNameMapper.NONE
    }

    return constant.waitingSound.defaultId
  }

  protected _resolveSoundVolumePercent(params: { rawRecord: Record<string, unknown> }): number {
    const volumePercent = this._resolveOptionalSoundVolumePercent({ value: params.rawRecord['soundVolumePercent'] })

    if (volumePercent !== undefined) {
      return volumePercent
    }

    return (
      this._resolveOptionalSoundVolumePercent({ value: params.rawRecord['waitingSoundVolumePercent'] }) ??
      constant.soundVolume.defaultPercent
    )
  }

  protected _resolveOptionalSoundVolumePercent(params: { value: unknown }): number | undefined {
    if (typeof params.value !== 'number' || !Number.isFinite(params.value)) {
      return undefined
    }

    const clampedVolumePercent = Math.min(
      Math.max(params.value, constant.soundVolume.minPercent),
      constant.soundVolume.maxPercent,
    )

    return Math.round(clampedVolumePercent)
  }

  protected _resolveTrackers(params: { rawRecord: Record<string, unknown>; rawTrackers: unknown }): TrackerConfig[] {
    if (!Array.isArray(params.rawTrackers)) {
      return this._migrateLegacyTrackers({ rawRecord: params.rawRecord })
    }

    const trackers = params.rawTrackers
      .map((rawTracker) => {
        return this._sanitizeTracker({ rawTracker })
      })
      .filter((tracker): tracker is TrackerConfig => {
        return tracker !== undefined
      })

    return this._ensureUniqueTrackerIds({ trackers })
  }

  protected _sanitizeTracker(params: { rawTracker: unknown }): TrackerConfig | undefined {
    const rawTracker = objectUtil.asRecord(params.rawTracker)

    if (rawTracker === undefined) {
      return undefined
    }

    return this._sanitizeTrackerByProviderId({ providerId: rawTracker['providerId'], rawTracker })
  }

  protected _sanitizeTrackerByProviderId(params: {
    providerId: unknown
    rawTracker: Record<string, unknown>
  }): TrackerConfig | undefined {
    switch (params.providerId) {
      case ProviderIdMapper.CLAUDE: {
        return {
          accessToken: this._resolveStringValue({ fallback: '', value: params.rawTracker['accessToken'] }),
          id: this._resolveTrackerId({ value: params.rawTracker['id'] }),
          isAutoRefreshPaused: this._resolveIsAutoRefreshPaused({ value: params.rawTracker['isAutoRefreshPaused'] }),
          name: this._resolveTrackerName({ providerId: ProviderIdMapper.CLAUDE, value: params.rawTracker['name'] }),
          providerId: ProviderIdMapper.CLAUDE,
          refreshIntervalMs: this._resolveRefreshIntervalMs({
            providerId: ProviderIdMapper.CLAUDE,
            rawTracker: params.rawTracker,
          }),
          tokenSource: this._resolveTokenSource({ value: params.rawTracker['tokenSource'] }),
        }
      }

      case ProviderIdMapper.ZAI: {
        return {
          accessToken: this._resolveStringValue({ fallback: '', value: params.rawTracker['accessToken'] }),
          id: this._resolveTrackerId({ value: params.rawTracker['id'] }),
          isAutoRefreshPaused: this._resolveIsAutoRefreshPaused({ value: params.rawTracker['isAutoRefreshPaused'] }),
          name: this._resolveTrackerName({ providerId: ProviderIdMapper.ZAI, value: params.rawTracker['name'] }),
          providerId: ProviderIdMapper.ZAI,
          refreshIntervalMs: this._resolveRefreshIntervalMs({
            providerId: ProviderIdMapper.ZAI,
            rawTracker: params.rawTracker,
          }),
        }
      }

      case ProviderIdMapper.DUMMY: {
        return this._sanitizeDummyTracker({ rawTracker: params.rawTracker })
      }

      default: {
        return undefined
      }
    }
  }

  protected _sanitizeDummyTracker(params: { rawTracker: Record<string, unknown> }): DummyTrackerConfig | undefined {
    const days = this._resolveTriggerDays({ value: params.rawTracker['days'] })
    const times = this._resolveTriggerTimes({ value: params.rawTracker['times'] })

    if (days.length === 0 || times.length === 0) {
      return undefined
    }

    return {
      accessToken: '',
      days,
      id: this._resolveTrackerId({ value: params.rawTracker['id'] }),
      isAutoRefreshPaused: this._resolveIsAutoRefreshPaused({ value: params.rawTracker['isAutoRefreshPaused'] }),
      name: this._resolveTrackerName({ providerId: ProviderIdMapper.DUMMY, value: params.rawTracker['name'] }),
      providerId: ProviderIdMapper.DUMMY,
      refreshIntervalMs: this._resolveRefreshIntervalMs({
        providerId: ProviderIdMapper.DUMMY,
        rawTracker: params.rawTracker,
      }),
      times,
    }
  }

  protected _migrateLegacyTrackers(params: { rawRecord: Record<string, unknown> }): TrackerConfig[] {
    const claudeConfig = this._migrateLegacyClaudeTracker({ rawRecord: params.rawRecord })
    const zaiConfig = this._migrateLegacyZaiTracker({ rawRecord: params.rawRecord })

    return [claudeConfig, zaiConfig].filter((tracker): tracker is ClaudeTrackerConfig | ZaiTrackerConfig => {
      return tracker !== undefined
    })
  }

  protected _migrateLegacyClaudeTracker(params: {
    rawRecord: Record<string, unknown>
  }): ClaudeTrackerConfig | undefined {
    const claudeToken = this._resolveStringValue({ fallback: '', value: params.rawRecord['claudeAccessToken'] })
    const tokenSource = this._resolveTokenSource({ value: params.rawRecord['claudeTokenSource'] })

    if (claudeToken === '' && tokenSource === ClaudeTokenSource.MANUAL) {
      return undefined
    }

    return {
      accessToken: claudeToken,
      id: crypto.randomUUID(),
      isAutoRefreshPaused: false,
      name: 'Claude',
      providerId: ProviderIdMapper.CLAUDE,
      refreshIntervalMs: this._resolveDefaultRefreshIntervalMs({ providerId: ProviderIdMapper.CLAUDE }),
      tokenSource,
    }
  }

  protected _migrateLegacyZaiTracker(params: { rawRecord: Record<string, unknown> }): ZaiTrackerConfig | undefined {
    const zaiToken = this._resolveStringValue({ fallback: '', value: params.rawRecord['zaiAccessToken'] })

    if (zaiToken === '') {
      return undefined
    }

    return {
      accessToken: zaiToken,
      id: crypto.randomUUID(),
      isAutoRefreshPaused: false,
      name: 'z.ai',
      providerId: ProviderIdMapper.ZAI,
      refreshIntervalMs: this._resolveDefaultRefreshIntervalMs({ providerId: ProviderIdMapper.ZAI }),
    }
  }

  protected _ensureUniqueTrackerIds(params: { trackers: TrackerConfig[] }): TrackerConfig[] {
    const seenIds = new Set<string>()

    return params.trackers.map((tracker) => {
      if (seenIds.has(tracker.id)) {
        return { ...tracker, id: crypto.randomUUID() }
      }

      seenIds.add(tracker.id)

      return tracker
    })
  }

  protected _resolveTriggers(params: { rawTriggers: unknown }): ScheduleTriggerConfig[] {
    if (!Array.isArray(params.rawTriggers)) {
      return []
    }

    const triggers = params.rawTriggers
      .map((rawTrigger) => {
        return this._sanitizeTrigger({ rawTrigger })
      })
      .filter((trigger): trigger is ScheduleTriggerConfig => {
        return trigger !== undefined
      })

    return this._ensureUniqueTriggerIds({ triggers })
  }

  protected _sanitizeTrigger(params: { rawTrigger: unknown }): ScheduleTriggerConfig | undefined {
    const rawTrigger = objectUtil.asRecord(params.rawTrigger)

    if (rawTrigger === undefined) {
      return undefined
    }

    const command = this._resolveTriggerCommand({ value: rawTrigger['command'] })
    const days = this._resolveTriggerDays({ value: rawTrigger['days'] })
    const times = this._resolveTriggerTimes({ value: rawTrigger['times'] })

    if (command === undefined || days.length === 0 || times.length === 0) {
      return undefined
    }

    return {
      command,
      createdAt: this._resolveTriggerCreatedAt({ value: rawTrigger['createdAt'] }),
      days,
      id: this._resolveTriggerId({ value: rawTrigger['id'] }),
      isEnabled: this._resolveIsTriggerEnabled({ value: rawTrigger['isEnabled'] }),
      name: this._resolveTriggerName({ value: rawTrigger['name'] }),
      timeoutMs: this._resolveTriggerTimeoutMs({ value: rawTrigger['timeoutMs'] }),
      times,
    }
  }

  protected _ensureUniqueTriggerIds(params: { triggers: ScheduleTriggerConfig[] }): ScheduleTriggerConfig[] {
    const seenIds = new Set<string>()

    return params.triggers.map((trigger) => {
      if (seenIds.has(trigger.id)) {
        return { ...trigger, id: crypto.randomUUID() }
      }

      seenIds.add(trigger.id)

      return trigger
    })
  }

  protected _resolveSshHosts(params: { rawSshHosts: unknown }): SshHostConfig[] {
    if (!Array.isArray(params.rawSshHosts)) {
      return []
    }

    const sshHosts = params.rawSshHosts
      .map((rawSshHost) => {
        return this._sanitizeSshHost({ rawSshHost })
      })
      .filter((sshHost): sshHost is SshHostConfig => {
        return sshHost !== undefined
      })

    return this._ensureUniqueSshHostIds({ sshHosts })
  }

  protected _sanitizeSshHost(params: { rawSshHost: unknown }): SshHostConfig | undefined {
    const rawSshHost = objectUtil.asRecord(params.rawSshHost)

    if (rawSshHost === undefined) {
      return undefined
    }

    const url = this._resolveSshHostUrl({ value: rawSshHost['url'] })

    if (url === undefined) {
      return undefined
    }

    return {
      id: this._resolveSshHostId({ value: rawSshHost['id'] }),
      isEnabled: this._resolveIsSshHostEnabled({ value: rawSshHost['isEnabled'] }),
      url,
    }
  }

  protected _ensureUniqueSshHostIds(params: { sshHosts: SshHostConfig[] }): SshHostConfig[] {
    const seenIds = new Set<string>()

    return params.sshHosts.map((sshHost) => {
      if (seenIds.has(sshHost.id)) {
        return { ...sshHost, id: crypto.randomUUID() }
      }

      seenIds.add(sshHost.id)

      return sshHost
    })
  }

  protected _resolveSshHostId(params: { value: unknown }): string {
    if (typeof params.value !== 'string' || params.value === '') {
      return crypto.randomUUID()
    }

    return params.value
  }

  protected _resolveSshHostUrl(params: { value: unknown }): string | undefined {
    if (typeof params.value !== 'string' || params.value.trim() === '') {
      return undefined
    }

    return params.value.trim()
  }

  protected _resolveIsSshHostEnabled(params: { value: unknown }): boolean {
    return params.value === true
  }

  protected _resolveTriggerCommand(params: { value: unknown }): string | undefined {
    if (typeof params.value !== 'string' || params.value.trim() === '') {
      return undefined
    }

    return params.value.trim()
  }

  protected _resolveTriggerCreatedAt(params: { value: unknown }): number {
    if (typeof params.value !== 'number' || !Number.isFinite(params.value)) {
      return Date.now()
    }

    return params.value
  }

  protected _resolveTriggerDays(params: { value: unknown }): ScheduleTriggerDayMapper[] {
    if (!Array.isArray(params.value)) {
      return []
    }

    const knownDays = new Set<string>(constant.scheduleTrigger.days)
    const selectedDays = new Set<ScheduleTriggerDayMapper>(
      params.value.filter((day): day is ScheduleTriggerDayMapper => {
        return typeof day === 'string' && knownDays.has(day)
      }),
    )

    return constant.scheduleTrigger.days.filter((day) => {
      return selectedDays.has(day)
    })
  }

  protected _resolveTriggerId(params: { value: unknown }): string {
    if (typeof params.value !== 'string' || params.value === '') {
      return crypto.randomUUID()
    }

    return params.value
  }

  protected _resolveTriggerName(params: { value: unknown }): string {
    if (typeof params.value === 'string' && params.value.trim() !== '') {
      return params.value.trim()
    }

    return 'Trigger'
  }

  protected _resolveTriggerTimes(params: { value: unknown }): string[] {
    if (!Array.isArray(params.value)) {
      return []
    }

    const times = params.value.filter((time): time is string => {
      return typeof time === 'string' && constant.twentyFourHourTimeRegex.test(time)
    })

    return [...new Set(times)].sort()
  }

  protected _resolveTriggerTimeoutMs(params: { value: unknown }): number {
    if (typeof params.value !== 'number' || !Number.isFinite(params.value)) {
      return constant.scheduleTrigger.timeout.defaultMs
    }

    const clampedTimeoutMs = Math.min(
      Math.max(params.value, constant.scheduleTrigger.timeout.minMs),
      constant.scheduleTrigger.timeout.maxMs,
    )

    return Math.round(clampedTimeoutMs)
  }

  protected _resolveIsTriggerEnabled(params: { value: unknown }): boolean {
    return params.value === true
  }

  protected _resolveTrackerId(params: { value: unknown }): string {
    if (typeof params.value !== 'string' || params.value === '') {
      return crypto.randomUUID()
    }

    return params.value
  }

  protected _resolveTrackerName(params: { providerId: ProviderIdMapper; value: unknown }): string {
    if (typeof params.value === 'string' && params.value !== '') {
      return params.value
    }

    const catalogEntry = constant.providerCatalog.find((entry) => {
      return entry.id === params.providerId
    })

    if (catalogEntry === undefined) {
      return params.providerId
    }

    return catalogEntry.name
  }

  protected _resolveIsAutoRefreshPaused(params: { value: unknown }): boolean {
    if (params.value === true) {
      return true
    }

    return false
  }

  protected _resolveStringValue(params: { fallback: string; value: unknown }): string {
    if (typeof params.value !== 'string') {
      return params.fallback
    }

    return params.value
  }

  protected _resolveTokenSource(params: { value: unknown }): ClaudeTokenSource {
    if (params.value === ClaudeTokenSource.SYSTEM || params.value === constant.legacyClaudeTokenSourceSystem) {
      return ClaudeTokenSource.SYSTEM
    }

    return ClaudeTokenSource.MANUAL
  }

  protected _resolveRefreshIntervalMs(params: {
    providerId: ProviderIdMapper
    rawTracker: Record<string, unknown>
  }): number {
    const intervalMs = this._resolveOptionalMs({
      legacySecondsKey: 'refreshIntervalSeconds',
      msKey: 'refreshIntervalMs',
      rawRecord: params.rawTracker,
    })

    if (intervalMs === undefined) {
      return this._resolveDefaultRefreshIntervalMs({ providerId: params.providerId })
    }

    const clampedIntervalMs = Math.min(
      Math.max(intervalMs, constant.trackerRefreshInterval.minMs),
      constant.trackerRefreshInterval.maxMs,
    )

    return Math.round(clampedIntervalMs)
  }

  protected _resolveDefaultRefreshIntervalMs(params: { providerId: ProviderIdMapper }): number {
    const catalogEntry = constant.providerCatalog.find((entry) => {
      return entry.id === params.providerId
    })

    if (catalogEntry === undefined) {
      return constant.trackerRefreshInterval.minMs
    }

    return catalogEntry.defaultRefreshIntervalMs
  }
}
