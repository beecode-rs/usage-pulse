import { objectUtil } from '#src/main/util/object-util'
import { ClaudeAccessTokenSource } from '#src/shared/business/enum/claude-access-token-source-enum'
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
    const { rawSettings } = params
    const rawRecord = objectUtil.asRecord(rawSettings)

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
    const { isEnabled, settings } = params

    return {
      ...settings,
      isSchedulingEnabled: isEnabled,
    }
  }

  setTrackerPaused(params: { isAutoRefreshPaused: boolean; settings: AppSettings; trackerId: string }): AppSettings {
    const { isAutoRefreshPaused, settings, trackerId } = params

    return {
      ...settings,
      trackers: settings.trackers.map((tracker) => {
        if (tracker.id !== trackerId) {
          return tracker
        }

        return { ...tracker, isAutoRefreshPaused }
      }),
    }
  }

  setTriggerEnabled(params: { isEnabled: boolean; settings: AppSettings; triggerId: string }): AppSettings {
    const { isEnabled, settings, triggerId } = params

    return {
      ...settings,
      triggers: settings.triggers.map((trigger) => {
        if (trigger.id !== triggerId) {
          return trigger
        }

        return { ...trigger, isEnabled }
      }),
    }
  }

  protected _resolveIsSchedulingEnabled(params: { value: unknown }): boolean {
    const { value } = params
    if (typeof value !== 'boolean') {
      return constant.scheduling.defaultIsEnabled
    }

    return value
  }

  protected _resolveIsSessionsAutoRefreshPaused(params: { value: unknown }): boolean {
    const { value } = params
    if (typeof value !== 'boolean') {
      return constant.sessionsAutoRefresh.defaultIsPaused
    }

    return value
  }

  protected _resolveSessionsRefreshIntervalMs(params: { rawRecord: Record<string, unknown> }): number {
    const { rawRecord } = params
    const intervalMs = this._resolveOptionalMs({
      legacySecondsKey: 'sessionsRefreshIntervalSeconds',
      msKey: 'sessionsRefreshIntervalMs',
      rawRecord,
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
    const { rawRecord } = params
    const pulseMs = this._resolveOptionalMs({
      legacySecondsKey: 'sessionFinishedPulseSeconds',
      msKey: 'sessionFinishedPulseMs',
      rawRecord,
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
    const { legacySecondsKey, msKey, rawRecord } = params
    const msValue = rawRecord[msKey]

    if (typeof msValue === 'number' && Number.isFinite(msValue)) {
      return msValue
    }

    const legacySecondsValue = rawRecord[legacySecondsKey]

    if (typeof legacySecondsValue === 'number' && Number.isFinite(legacySecondsValue)) {
      return legacySecondsValue * 1000
    }

    return undefined
  }

  protected _resolveSessionFinishedSoundId(params: { rawRecord: Record<string, unknown> }): SoundNameMapper {
    const { rawRecord } = params
    const soundId = this._resolveOptionalSoundNameMapper({ value: rawRecord['sessionFinishedSoundId'] })

    if (soundId !== undefined) {
      return soundId
    }

    const legacySoundId = this._resolveOptionalSoundNameMapper({ value: rawRecord['idleSoundId'] })

    if (legacySoundId !== undefined) {
      return legacySoundId
    }

    return constant.sessionFinishedSound.defaultId
  }

  protected _resolveOptionalSoundNameMapper(params: { value: unknown }): SoundNameMapper | undefined {
    const { value } = params

    return constant.sessionSoundIds.find((candidate) => {
      return candidate === value
    })
  }

  protected _resolveWaitingSoundId(params: { rawRecord: Record<string, unknown> }): SoundNameMapper {
    const { rawRecord } = params
    const soundId = this._resolveOptionalSoundNameMapper({ value: rawRecord['waitingSoundId'] })

    if (soundId !== undefined) {
      return soundId
    }

    if (rawRecord['isWaitingSoundEnabled'] === false) {
      return SoundNameMapper.NONE
    }

    return constant.waitingSound.defaultId
  }

  protected _resolveSoundVolumePercent(params: { rawRecord: Record<string, unknown> }): number {
    const { rawRecord } = params
    const volumePercent = this._resolveOptionalSoundVolumePercent({ value: rawRecord['soundVolumePercent'] })

    if (volumePercent !== undefined) {
      return volumePercent
    }

    return (
      this._resolveOptionalSoundVolumePercent({ value: rawRecord['waitingSoundVolumePercent'] }) ??
      constant.soundVolume.defaultPercent
    )
  }

  protected _resolveOptionalSoundVolumePercent(params: { value: unknown }): number | undefined {
    const { value } = params
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return undefined
    }

    const clampedVolumePercent = Math.min(
      Math.max(value, constant.soundVolume.minPercent),
      constant.soundVolume.maxPercent,
    )

    return Math.round(clampedVolumePercent)
  }

  protected _resolveTrackers(params: { rawRecord: Record<string, unknown>; rawTrackers: unknown }): TrackerConfig[] {
    const { rawRecord, rawTrackers } = params
    if (!Array.isArray(rawTrackers)) {
      return this._migrateLegacyTrackers({ rawRecord })
    }

    const trackers = rawTrackers
      .map((rawTracker) => {
        return this._sanitizeTracker({ rawTracker })
      })
      .filter((tracker): tracker is TrackerConfig => {
        return tracker !== undefined
      })

    return this._ensureUniqueTrackerIds({ trackers })
  }

  protected _sanitizeTracker(params: { rawTracker: unknown }): TrackerConfig | undefined {
    const { rawTracker: rawValue } = params
    const rawTracker = objectUtil.asRecord(rawValue)

    if (rawTracker === undefined) {
      return undefined
    }

    return this._sanitizeTrackerByProviderId({ providerId: rawTracker['providerId'], rawTracker })
  }

  protected _sanitizeTrackerByProviderId(params: {
    providerId: unknown
    rawTracker: Record<string, unknown>
  }): TrackerConfig | undefined {
    const { providerId, rawTracker } = params
    switch (providerId) {
      case ProviderIdMapper.CLAUDE: {
        return {
          accessToken: this._resolveStringValue({ fallback: '', value: rawTracker['accessToken'] }),
          accessTokenSource: this._resolveAccessTokenSource({
            value: rawTracker['accessTokenSource'] ?? rawTracker['tokenSource'],
          }),
          id: this._resolveTrackerId({ value: rawTracker['id'] }),
          isAutoRefreshPaused: this._resolveIsAutoRefreshPaused({ value: rawTracker['isAutoRefreshPaused'] }),
          name: this._resolveTrackerName({ providerId: ProviderIdMapper.CLAUDE, value: rawTracker['name'] }),
          providerId: ProviderIdMapper.CLAUDE,
          refreshIntervalMs: this._resolveRefreshIntervalMs({
            providerId: ProviderIdMapper.CLAUDE,
            rawTracker,
          }),
        }
      }

      case ProviderIdMapper.ZAI: {
        return {
          accessToken: this._resolveStringValue({ fallback: '', value: rawTracker['accessToken'] }),
          id: this._resolveTrackerId({ value: rawTracker['id'] }),
          isAutoRefreshPaused: this._resolveIsAutoRefreshPaused({ value: rawTracker['isAutoRefreshPaused'] }),
          name: this._resolveTrackerName({ providerId: ProviderIdMapper.ZAI, value: rawTracker['name'] }),
          providerId: ProviderIdMapper.ZAI,
          refreshIntervalMs: this._resolveRefreshIntervalMs({
            providerId: ProviderIdMapper.ZAI,
            rawTracker,
          }),
        }
      }

      case ProviderIdMapper.DUMMY: {
        return this._sanitizeDummyTracker({ rawTracker })
      }

      default: {
        return undefined
      }
    }
  }

  protected _sanitizeDummyTracker(params: { rawTracker: Record<string, unknown> }): DummyTrackerConfig | undefined {
    const { rawTracker } = params
    const days = this._resolveTriggerDays({ value: rawTracker['days'] })
    const times = this._resolveTriggerTimes({ value: rawTracker['times'] })

    if (days.length === 0 || times.length === 0) {
      return undefined
    }

    return {
      accessToken: '',
      days,
      id: this._resolveTrackerId({ value: rawTracker['id'] }),
      isAutoRefreshPaused: this._resolveIsAutoRefreshPaused({ value: rawTracker['isAutoRefreshPaused'] }),
      name: this._resolveTrackerName({ providerId: ProviderIdMapper.DUMMY, value: rawTracker['name'] }),
      providerId: ProviderIdMapper.DUMMY,
      refreshIntervalMs: this._resolveRefreshIntervalMs({
        providerId: ProviderIdMapper.DUMMY,
        rawTracker,
      }),
      times,
    }
  }

  protected _migrateLegacyTrackers(params: { rawRecord: Record<string, unknown> }): TrackerConfig[] {
    const { rawRecord } = params
    const claudeConfig = this._migrateLegacyClaudeTracker({ rawRecord })
    const zaiConfig = this._migrateLegacyZaiTracker({ rawRecord })

    return [claudeConfig, zaiConfig].filter((tracker): tracker is ClaudeTrackerConfig | ZaiTrackerConfig => {
      return tracker !== undefined
    })
  }

  protected _migrateLegacyClaudeTracker(params: {
    rawRecord: Record<string, unknown>
  }): ClaudeTrackerConfig | undefined {
    const { rawRecord } = params
    const claudeToken = this._resolveStringValue({ fallback: '', value: rawRecord['claudeAccessToken'] })
    const accessTokenSource = this._resolveAccessTokenSource({ value: rawRecord['claudeTokenSource'] })

    if (claudeToken === '' && accessTokenSource === ClaudeAccessTokenSource.MANUAL) {
      return undefined
    }

    return {
      accessToken: claudeToken,
      accessTokenSource,
      id: crypto.randomUUID(),
      isAutoRefreshPaused: false,
      name: 'Claude',
      providerId: ProviderIdMapper.CLAUDE,
      refreshIntervalMs: this._resolveDefaultRefreshIntervalMs({ providerId: ProviderIdMapper.CLAUDE }),
    }
  }

  protected _migrateLegacyZaiTracker(params: { rawRecord: Record<string, unknown> }): ZaiTrackerConfig | undefined {
    const { rawRecord } = params
    const zaiToken = this._resolveStringValue({ fallback: '', value: rawRecord['zaiAccessToken'] })

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
    const { trackers } = params
    const seenIds = new Set<string>()

    return trackers.map((tracker) => {
      if (seenIds.has(tracker.id)) {
        return { ...tracker, id: crypto.randomUUID() }
      }

      seenIds.add(tracker.id)

      return tracker
    })
  }

  protected _resolveTriggers(params: { rawTriggers: unknown }): ScheduleTriggerConfig[] {
    const { rawTriggers } = params
    if (!Array.isArray(rawTriggers)) {
      return []
    }

    const triggers = rawTriggers
      .map((rawTrigger) => {
        return this._sanitizeTrigger({ rawTrigger })
      })
      .filter((trigger): trigger is ScheduleTriggerConfig => {
        return trigger !== undefined
      })

    return this._ensureUniqueTriggerIds({ triggers })
  }

  protected _sanitizeTrigger(params: { rawTrigger: unknown }): ScheduleTriggerConfig | undefined {
    const { rawTrigger: rawValue } = params
    const rawTrigger = objectUtil.asRecord(rawValue)

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
    const { triggers } = params
    const seenIds = new Set<string>()

    return triggers.map((trigger) => {
      if (seenIds.has(trigger.id)) {
        return { ...trigger, id: crypto.randomUUID() }
      }

      seenIds.add(trigger.id)

      return trigger
    })
  }

  protected _resolveSshHosts(params: { rawSshHosts: unknown }): SshHostConfig[] {
    const { rawSshHosts } = params
    if (!Array.isArray(rawSshHosts)) {
      return []
    }

    const sshHosts = rawSshHosts
      .map((rawSshHost) => {
        return this._sanitizeSshHost({ rawSshHost })
      })
      .filter((sshHost): sshHost is SshHostConfig => {
        return sshHost !== undefined
      })

    return this._ensureUniqueSshHostIds({ sshHosts })
  }

  protected _sanitizeSshHost(params: { rawSshHost: unknown }): SshHostConfig | undefined {
    const { rawSshHost: rawValue } = params
    const rawSshHost = objectUtil.asRecord(rawValue)

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
    const { sshHosts } = params
    const seenIds = new Set<string>()

    return sshHosts.map((sshHost) => {
      if (seenIds.has(sshHost.id)) {
        return { ...sshHost, id: crypto.randomUUID() }
      }

      seenIds.add(sshHost.id)

      return sshHost
    })
  }

  protected _resolveSshHostId(params: { value: unknown }): string {
    const { value } = params
    if (typeof value !== 'string' || value === '') {
      return crypto.randomUUID()
    }

    return value
  }

  protected _resolveSshHostUrl(params: { value: unknown }): string | undefined {
    const { value } = params
    if (typeof value !== 'string' || value.trim() === '') {
      return undefined
    }

    return value.trim()
  }

  protected _resolveIsSshHostEnabled(params: { value: unknown }): boolean {
    const { value } = params

    return value === true
  }

  protected _resolveTriggerCommand(params: { value: unknown }): string | undefined {
    const { value } = params
    if (typeof value !== 'string' || value.trim() === '') {
      return undefined
    }

    return value.trim()
  }

  protected _resolveTriggerCreatedAt(params: { value: unknown }): number {
    const { value } = params
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return Date.now()
    }

    return value
  }

  protected _resolveTriggerDays(params: { value: unknown }): ScheduleTriggerDayMapper[] {
    const { value } = params
    if (!Array.isArray(value)) {
      return []
    }

    const knownDays = new Set<string>(constant.scheduleTrigger.days)
    const selectedDays = new Set<ScheduleTriggerDayMapper>(
      value.filter((day): day is ScheduleTriggerDayMapper => {
        return typeof day === 'string' && knownDays.has(day)
      }),
    )

    return constant.scheduleTrigger.days.filter((day) => {
      return selectedDays.has(day)
    })
  }

  protected _resolveTriggerId(params: { value: unknown }): string {
    const { value } = params
    if (typeof value !== 'string' || value === '') {
      return crypto.randomUUID()
    }

    return value
  }

  protected _resolveTriggerName(params: { value: unknown }): string {
    const { value } = params
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim()
    }

    return 'Trigger'
  }

  protected _resolveTriggerTimes(params: { value: unknown }): string[] {
    const { value } = params
    if (!Array.isArray(value)) {
      return []
    }

    const times = value.filter((time): time is string => {
      return typeof time === 'string' && constant.twentyFourHourTimeRegex.test(time)
    })

    return [...new Set(times)].sort()
  }

  protected _resolveTriggerTimeoutMs(params: { value: unknown }): number {
    const { value } = params
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return constant.scheduleTrigger.timeout.defaultMs
    }

    const clampedTimeoutMs = Math.min(
      Math.max(value, constant.scheduleTrigger.timeout.minMs),
      constant.scheduleTrigger.timeout.maxMs,
    )

    return Math.round(clampedTimeoutMs)
  }

  protected _resolveIsTriggerEnabled(params: { value: unknown }): boolean {
    const { value } = params

    return value === true
  }

  protected _resolveTrackerId(params: { value: unknown }): string {
    const { value } = params
    if (typeof value !== 'string' || value === '') {
      return crypto.randomUUID()
    }

    return value
  }

  protected _resolveTrackerName(params: { providerId: ProviderIdMapper; value: unknown }): string {
    const { providerId, value } = params
    if (typeof value === 'string' && value !== '') {
      return value
    }

    const catalogEntry = constant.providerCatalog.find((entry) => {
      return entry.id === providerId
    })

    if (catalogEntry === undefined) {
      return providerId
    }

    return catalogEntry.name
  }

  protected _resolveIsAutoRefreshPaused(params: { value: unknown }): boolean {
    const { value } = params
    if (value === true) {
      return true
    }

    return false
  }

  protected _resolveStringValue(params: { fallback: string; value: unknown }): string {
    const { fallback, value } = params
    if (typeof value !== 'string') {
      return fallback
    }

    return value
  }

  protected _resolveAccessTokenSource(params: { value: unknown }): ClaudeAccessTokenSource {
    const { value } = params
    if (value === ClaudeAccessTokenSource.SYSTEM || value === constant.legacyClaudeAccessTokenSourceSystem) {
      return ClaudeAccessTokenSource.SYSTEM
    }

    return ClaudeAccessTokenSource.MANUAL
  }

  protected _resolveRefreshIntervalMs(params: {
    providerId: ProviderIdMapper
    rawTracker: Record<string, unknown>
  }): number {
    const { providerId, rawTracker } = params
    const intervalMs = this._resolveOptionalMs({
      legacySecondsKey: 'refreshIntervalSeconds',
      msKey: 'refreshIntervalMs',
      rawRecord: rawTracker,
    })

    if (intervalMs === undefined) {
      return this._resolveDefaultRefreshIntervalMs({ providerId })
    }

    const clampedIntervalMs = Math.min(
      Math.max(intervalMs, constant.trackerRefreshInterval.minMs),
      constant.trackerRefreshInterval.maxMs,
    )

    return Math.round(clampedIntervalMs)
  }

  protected _resolveDefaultRefreshIntervalMs(params: { providerId: ProviderIdMapper }): number {
    const { providerId } = params
    const catalogEntry = constant.providerCatalog.find((entry) => {
      return entry.id === providerId
    })

    if (catalogEntry === undefined) {
      return constant.trackerRefreshInterval.minMs
    }

    return catalogEntry.defaultRefreshIntervalMs
  }
}
