import { LifeCycle } from '@beecode/msh-app-boot'

import { type SettingsLifeCycle } from '#src/main/app-boot/settings-life-cycle'
import { type UsagePollService } from '#src/main/business/service/usage-poll-service'

export class UsagePollLifeCycle extends LifeCycle<void> {
  protected readonly _pollService: UsagePollService
  protected readonly _settingsLifeCycle: SettingsLifeCycle

  constructor(params: { pollService: UsagePollService; settingsLifeCycle: SettingsLifeCycle }) {
    super({ name: 'usage poll' })
    this._pollService = params.pollService
    this._settingsLifeCycle = params.settingsLifeCycle
  }

  protected async _createFn(): Promise<void> {
    await this._pollService.start({ settings: this._settingsLifeCycle.getSettings() })
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
