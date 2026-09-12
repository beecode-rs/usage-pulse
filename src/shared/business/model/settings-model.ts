import type { ClaudeAccessTokenSource } from '#src/shared/business/enum/claude-access-token-source-enum'
import type { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import type { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'
import type { SoundNameMapper } from '#src/shared/business/enum/sound-name-mapper-enum'
import type { ScheduleTriggerConfig } from '#src/shared/business/model/schedule-trigger-model'

export interface TrackerConfigBase {
  accessToken: string
  id: string
  isAutoRefreshPaused: boolean
  name: string
  refreshIntervalMs: number
}

export interface ClaudeTrackerConfig extends TrackerConfigBase {
  providerId: ProviderIdMapper.CLAUDE
  accessTokenSource: ClaudeAccessTokenSource
}

export interface DummyTrackerConfig extends TrackerConfigBase {
  days: ScheduleTriggerDayMapper[]
  providerId: ProviderIdMapper.DUMMY
  times: string[]
}

export interface ZaiTrackerConfig extends TrackerConfigBase {
  providerId: ProviderIdMapper.ZAI
}

export type TrackerConfig = ClaudeTrackerConfig | DummyTrackerConfig | ZaiTrackerConfig

export type SshHostConfig = {
  id: string
  isEnabled: boolean
  url: string
}

export type AppSettings = {
  isSchedulingEnabled: boolean
  isSessionsAutoRefreshPaused: boolean
  sessionFinishedPulseMs: number
  sessionFinishedSoundId: SoundNameMapper
  sessionsRefreshIntervalMs: number
  soundVolumePercent: number
  sshHosts: SshHostConfig[]
  trackers: TrackerConfig[]
  triggers: ScheduleTriggerConfig[]
  waitingSoundId: SoundNameMapper
}
