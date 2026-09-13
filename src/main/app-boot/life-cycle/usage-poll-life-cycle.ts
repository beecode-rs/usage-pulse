import { LifeCycle } from '@beecode/msh-app-boot'

import { type SettingsLifeCycle } from '#src/main/app-boot/life-cycle/settings-life-cycle'
import { usagePollServiceSingleton } from '#src/main/business/service/usage-poll-service-singleton'

export class UsagePollLifeCycle extends LifeCycle<void> {
  protected readonly _pollService = usagePollServiceSingleton()
  protected readonly _settingsLifeCycle: SettingsLifeCycle

  constructor(params: { settingsLifeCycle: SettingsLifeCycle }) {
    const { settingsLifeCycle } = params
    super({ name: 'usage poll' })
    this._settingsLifeCycle = settingsLifeCycle
  }

  protected async _createFn(): Promise<void> {
    await this._pollService.start({ settings: this._settingsLifeCycle.getSettings() })
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
