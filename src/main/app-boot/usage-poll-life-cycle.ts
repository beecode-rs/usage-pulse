import { LifeCycle } from '@beecode/msh-app-boot'

import { type SettingsLifeCycle } from '#src/main/app-boot/settings-life-cycle'
import { type _UsagePollService } from '#src/main/business/service/usage-poll-service-singleton'

export class UsagePollLifeCycle extends LifeCycle<void> {
  protected readonly _pollService: _UsagePollService
  protected readonly _settingsLifeCycle: SettingsLifeCycle

  constructor(params: { pollService: _UsagePollService; settingsLifeCycle: SettingsLifeCycle }) {
    const { pollService, settingsLifeCycle } = params
    super({ name: 'usage poll' })
    this._pollService = pollService
    this._settingsLifeCycle = settingsLifeCycle
  }

  protected async _createFn(): Promise<void> {
    await this._pollService.start({ settings: this._settingsLifeCycle.getSettings() })
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
