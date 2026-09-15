import { LifeCycle } from '@beecode/msh-app-boot'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { schedulingServiceSingleton } from '#src/main/business/service/scheduling-service-singleton'

export class SettingsLifeCycle extends LifeCycle<void> {
  protected readonly _schedulingService = schedulingServiceSingleton()
  protected readonly _settingsRepo = settingsRepoSingleton()

  constructor() {
    super({ name: 'settings' })
  }

  protected async _createFn(): Promise<void> {
    await this._settingsRepo.init()
    await this._schedulingService.syncRegistrations().catch(() => {
      return undefined
    })
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
