import { LifeCycle } from '@beecode/msh-app-boot'

import { type _SettingsRepo } from '#src/main/business/repo/settings-repo-singleton'
import { type _SchedulingService } from '#src/main/business/service/scheduling-service-singleton'
import { type AppSettings } from '#src/shared/business/model/settings-model'

export class SettingsLifeCycle extends LifeCycle<void> {
  protected readonly _schedulingService: _SchedulingService
  protected readonly _settingsRepo: _SettingsRepo
  protected _settings?: AppSettings

  constructor(params: { schedulingService: _SchedulingService; settingsRepo: _SettingsRepo }) {
    const { schedulingService, settingsRepo } = params
    super({ name: 'settings' })
    this._schedulingService = schedulingService
    this._settingsRepo = settingsRepo
  }

  getSettings(): AppSettings {
    if (this._settings === undefined) {
      throw new Error('settings are not initialized')
    }

    return this._settings
  }

  protected async _createFn(): Promise<void> {
    const settings = await this._settingsRepo.load()

    this._settings = settings
    await this._settingsRepo.save({ settings })
    await this._schedulingService.syncRegistrations({ settings }).catch(() => {
      return undefined
    })
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
