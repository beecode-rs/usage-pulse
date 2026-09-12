import { LifeCycle } from '@beecode/msh-app-boot'

import { type SettingsLifeCycle } from '#src/main/app-boot/settings-life-cycle'
import { type _SessionsPollService } from '#src/main/business/service/sessions-poll-service-singleton'

export class SessionsPollLifeCycle extends LifeCycle<void> {
  protected readonly _sessionsPollService: _SessionsPollService
  protected readonly _settingsLifeCycle: SettingsLifeCycle

  constructor(params: { sessionsPollService: _SessionsPollService; settingsLifeCycle: SettingsLifeCycle }) {
    const { sessionsPollService, settingsLifeCycle } = params
    super({ name: 'sessions poll' })
    this._sessionsPollService = sessionsPollService
    this._settingsLifeCycle = settingsLifeCycle
  }

  protected async _createFn(): Promise<void> {
    await this._sessionsPollService.start({ settings: this._settingsLifeCycle.getSettings() })
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
