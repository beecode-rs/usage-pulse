import type { ClaudeAccessTokenSource } from '#src/shared/business/enum/claude-access-token-source-enum'
import type { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import type { SoundNameMapper } from '#src/shared/business/enum/sound-name-mapper-enum'
import type { ScheduleTriggerConfig } from '#src/shared/business/model/schedule-trigger-model'
import { constant } from '#src/shared/util/constant'

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

export interface ZaiTrackerConfig extends TrackerConfigBase {
  providerId: ProviderIdMapper.ZAI
}

export type TrackerConfig = ClaudeTrackerConfig | ZaiTrackerConfig

export type SshHostConfig = {
  id: string
  isEnabled: boolean
  url: string
}

export type SettingsData = {
  [
    Key in keyof SettingsModel as SettingsModel[Key] extends (...args: never[]) => unknown ? never : Key
  ]: SettingsModel[Key]
}

export class SettingsModel {
  isSchedulingEnabled = constant.scheduling.defaultIsEnabled
  isSessionsAutoRefreshPaused = constant.sessionsAutoRefresh.defaultIsPaused
  sessionFinishedPulseMs = constant.sessionFinishedPulse.defaultMs
  sessionFinishedSoundId = constant.sessionFinishedSound.defaultId
  sessionsRefreshIntervalMs = constant.sessionsRefreshInterval.defaultMs
  soundVolumePercent = constant.soundVolume.defaultPercent
  sshHosts: SshHostConfig[] = []
  trackers: TrackerConfig[] = []
  triggers: ScheduleTriggerConfig[] = []
  waitingSoundId = constant.waitingSound.defaultId

  constructor(params?: { settings?: SettingsData }) {
    const { settings } = params ?? {}

    if (settings !== undefined) {
      Object.assign(this, settings)
    }
  }

  withSchedulingEnabled(params: { isEnabled: boolean }): SettingsModel {
    const { isEnabled } = params

    return new SettingsModel({ settings: { ...this, isSchedulingEnabled: isEnabled } })
  }

  withTrackerPaused(params: { isAutoRefreshPaused: boolean; trackerId: string }): SettingsModel {
    const { isAutoRefreshPaused, trackerId } = params

    return new SettingsModel({
      settings: {
        ...this,
        trackers: this.trackers.map((tracker) => {
          if (tracker.id !== trackerId) {
            return tracker
          }

          return { ...tracker, isAutoRefreshPaused }
        }),
      },
    })
  }

  withTriggerEnabled(params: { isEnabled: boolean; triggerId: string }): SettingsModel {
    const { isEnabled, triggerId } = params

    return new SettingsModel({
      settings: {
        ...this,
        triggers: this.triggers.map((trigger) => {
          if (trigger.id !== triggerId) {
            return trigger
          }

          return { ...trigger, isEnabled }
        }),
      },
    })
  }
}
