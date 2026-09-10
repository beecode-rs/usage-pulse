import { type SettingsRepo, type SettingsSaveListener } from '#src/main/business/repo/settings-repo'
import { type SchedulingService } from '#src/main/business/service/scheduling-service'
import { type SessionsPollService } from '#src/main/business/service/sessions-poll-service'
import { type SettingsService } from '#src/main/business/service/settings-service'
import { type UsagePollService } from '#src/main/business/service/usage-poll-service'
import { type IAppSettings } from '#src/shared/settings-model'

export class SettingsUseCase {
  protected readonly _pollService: UsagePollService
  protected readonly _schedulingService: SchedulingService
  protected readonly _sessionsPollService: SessionsPollService
  protected readonly _settingsRepo: SettingsRepo
  protected readonly _settingsService: SettingsService

  constructor(params: {
    pollService: UsagePollService
    schedulingService: SchedulingService
    sessionsPollService: SessionsPollService
    settingsRepo: SettingsRepo
    settingsService: SettingsService
  }) {
    this._pollService = params.pollService
    this._schedulingService = params.schedulingService
    this._sessionsPollService = params.sessionsPollService
    this._settingsRepo = params.settingsRepo
    this._settingsService = params.settingsService
  }

  async loadSettings(): Promise<IAppSettings> {
    return await this._settingsRepo.load()
  }

  onSave(params: { listener: SettingsSaveListener }): void {
    this._settingsRepo.onSave({ listener: params.listener })
  }

  async saveSettings(params: { rawSettings: unknown }): Promise<IAppSettings> {
    const settings = this._settingsService.sanitizeSettings({ rawSettings: params.rawSettings })

    await this._settingsRepo.save({ settings })
    await this._pollService.restart({ settings })
    await this._sessionsPollService.restart({ settings })
    await this._schedulingService.syncRegistrations({ settings })

    return settings
  }

  async setSchedulingEnabled(params: { isEnabled: boolean }): Promise<IAppSettings> {
    const settings = await this._settingsRepo.load()
    const nextSettings = this._settingsService.setSchedulingEnabled({ isEnabled: params.isEnabled, settings })

    await this._settingsRepo.save({ settings: nextSettings })
    await this._schedulingService.syncRegistrations({ settings: nextSettings })

    return nextSettings
  }

  async setTrackerPaused(params: { isAutoRefreshPaused: boolean; trackerId: string }): Promise<IAppSettings> {
    const settings = await this._settingsRepo.load()
    const nextSettings = this._settingsService.setTrackerPaused({
      isAutoRefreshPaused: params.isAutoRefreshPaused,
      settings,
      trackerId: params.trackerId,
    })

    await this._settingsRepo.save({ settings: nextSettings })
    await this._pollService.applyTrackerAutoRefresh({ settings: nextSettings, trackerId: params.trackerId })
    void this._schedulingService.syncRegistrations({ settings: nextSettings }).catch(() => {
      return undefined
    })

    return nextSettings
  }

  async setTriggerEnabled(params: { isEnabled: boolean; triggerId: string }): Promise<IAppSettings> {
    const settings = await this._settingsRepo.load()
    const nextSettings = this._settingsService.setTriggerEnabled({
      isEnabled: params.isEnabled,
      settings,
      triggerId: params.triggerId,
    })

    await this._settingsRepo.save({ settings: nextSettings })
    await this._schedulingService.syncRegistrations({ settings: nextSettings })

    return nextSettings
  }
}
