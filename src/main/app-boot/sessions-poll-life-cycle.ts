import { LifeCycle } from '@beecode/msh-app-boot'

import { type SettingsLifeCycle } from '#src/main/app-boot/settings-life-cycle'
import { type SessionsPollService } from '#src/main/business/service/sessions-poll-service'

export class SessionsPollLifeCycle extends LifeCycle<void> {
  protected readonly _sessionsPollService: SessionsPollService
  protected readonly _settingsLifeCycle: SettingsLifeCycle

  constructor(params: { sessionsPollService: SessionsPollService; settingsLifeCycle: SettingsLifeCycle }) {
    super({ name: 'sessions poll' })
    this._sessionsPollService = params.sessionsPollService
    this._settingsLifeCycle = params.settingsLifeCycle
  }

  protected async _createFn(): Promise<void> {
    await this._sessionsPollService.start({ settings: this._settingsLifeCycle.getSettings() })
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
