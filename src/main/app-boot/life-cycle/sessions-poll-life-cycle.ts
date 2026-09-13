import { LifeCycle } from '@beecode/msh-app-boot'

import { type SettingsLifeCycle } from '#src/main/app-boot/life-cycle/settings-life-cycle'
import { sessionsPollServiceSingleton } from '#src/main/business/service/sessions-poll-service-singleton'

export class SessionsPollLifeCycle extends LifeCycle<void> {
  protected readonly _sessionsPollService = sessionsPollServiceSingleton()
  protected readonly _settingsLifeCycle: SettingsLifeCycle

  constructor(params: { settingsLifeCycle: SettingsLifeCycle }) {
    const { settingsLifeCycle } = params
    super({ name: 'sessions poll' })
    this._settingsLifeCycle = settingsLifeCycle
  }

  protected async _createFn(): Promise<void> {
    await this._sessionsPollService.start({ settings: this._settingsLifeCycle.getSettings() })
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
