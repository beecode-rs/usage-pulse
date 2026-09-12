import { singletonPattern } from '@beecode/msh-util'

import {
  type SettingsSaveListener,
  type _SettingsRepo,
  settingsRepoSingleton,
} from '#src/main/business/repo/settings-repo-singleton'
import {
  type _SchedulingService,
  schedulingServiceSingleton,
} from '#src/main/business/service/scheduling-service-singleton'
import {
  type _SessionsPollService,
  sessionsPollServiceSingleton,
} from '#src/main/business/service/sessions-poll-service-singleton'
import { SettingsService } from '#src/main/business/service/settings-service'
import {
  type _UsagePollService,
  usagePollServiceSingleton,
} from '#src/main/business/service/usage-poll-service-singleton'
import { type AppSettings } from '#src/shared/business/model/settings-model'

export class _SettingsUseCase {
  protected readonly _pollService: _UsagePollService
  protected readonly _schedulingService: _SchedulingService
  protected readonly _sessionsPollService: _SessionsPollService
  protected readonly _settingsRepo: _SettingsRepo
  protected readonly _settingsService: SettingsService

  constructor(params: {
    pollService: _UsagePollService
    schedulingService: _SchedulingService
    sessionsPollService: _SessionsPollService
    settingsRepo: _SettingsRepo
    settingsService: SettingsService
  }) {
    const { pollService, schedulingService, sessionsPollService, settingsRepo, settingsService } = params
    this._pollService = pollService
    this._schedulingService = schedulingService
    this._sessionsPollService = sessionsPollService
    this._settingsRepo = settingsRepo
    this._settingsService = settingsService
  }

  async loadSettings(): Promise<AppSettings> {
    return await this._settingsRepo.load()
  }

  onSave(params: { listener: SettingsSaveListener }): void {
    const { listener } = params
    this._settingsRepo.onSave({ listener })
  }

  async saveSettings(params: { rawSettings: unknown }): Promise<AppSettings> {
    const { rawSettings } = params
    const settings = this._settingsService.sanitizeSettings({ rawSettings })

    await this._settingsRepo.save({ settings })
    await this._pollService.restart({ settings })
    await this._sessionsPollService.restart({ settings })
    await this._schedulingService.syncRegistrations({ settings })

    return settings
  }

  async setSchedulingEnabled(params: { isEnabled: boolean }): Promise<AppSettings> {
    const { isEnabled } = params
    const settings = await this._settingsRepo.load()
    const nextSettings = this._settingsService.setSchedulingEnabled({ isEnabled, settings })

    await this._settingsRepo.save({ settings: nextSettings })
    await this._schedulingService.syncRegistrations({ settings: nextSettings })

    return nextSettings
  }

  async setTrackerPaused(params: { isAutoRefreshPaused: boolean; trackerId: string }): Promise<AppSettings> {
    const { isAutoRefreshPaused, trackerId } = params
    const settings = await this._settingsRepo.load()
    const nextSettings = this._settingsService.setTrackerPaused({
      isAutoRefreshPaused,
      settings,
      trackerId,
    })

    await this._settingsRepo.save({ settings: nextSettings })
    await this._pollService.applyTrackerAutoRefresh({ settings: nextSettings, trackerId })
    void this._schedulingService.syncRegistrations({ settings: nextSettings }).catch(() => {
      return undefined
    })

    return nextSettings
  }

  async setTriggerEnabled(params: { isEnabled: boolean; triggerId: string }): Promise<AppSettings> {
    const { isEnabled, triggerId } = params
    const settings = await this._settingsRepo.load()
    const nextSettings = this._settingsService.setTriggerEnabled({
      isEnabled,
      settings,
      triggerId,
    })

    await this._settingsRepo.save({ settings: nextSettings })
    await this._schedulingService.syncRegistrations({ settings: nextSettings })

    return nextSettings
  }
}

export const settingsUseCaseSingleton = singletonPattern(() => {
  return new _SettingsUseCase({
    pollService: usagePollServiceSingleton(),
    schedulingService: schedulingServiceSingleton(),
    sessionsPollService: sessionsPollServiceSingleton(),
    settingsRepo: settingsRepoSingleton(),
    settingsService: new SettingsService(),
  })
})
