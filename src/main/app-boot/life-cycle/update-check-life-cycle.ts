import { LifeCycle } from '@beecode/msh-app-boot'

import { updateServiceSingleton } from '#src/main/business/service/update-service-singleton'

export class UpdateCheckLifeCycle extends LifeCycle<void> {
  protected readonly _updateService = updateServiceSingleton()

  constructor() {
    super({ name: 'update check' })
  }

  protected _createFn(): Promise<void> {
    void this._updateService.checkForUpdate().catch(() => {
      return undefined
    })

    return Promise.resolve()
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
