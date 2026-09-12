import { LifeCycle } from '@beecode/msh-app-boot'

import { type _UpdateService } from '#src/main/business/service/update-service-singleton'

export class UpdateCheckLifeCycle extends LifeCycle<void> {
  protected readonly _updateService: _UpdateService

  constructor(params: { updateService: _UpdateService }) {
    const { updateService } = params
    super({ name: 'update check' })
    this._updateService = updateService
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
