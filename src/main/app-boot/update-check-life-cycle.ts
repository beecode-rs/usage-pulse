import { LifeCycle } from '@beecode/msh-app-boot'

import { type UpdateService } from '#src/main/business/service/update-service'

export class UpdateCheckLifeCycle extends LifeCycle<void> {
  protected readonly _updateService: UpdateService

  constructor(params: { updateService: UpdateService }) {
    super({ name: 'update check' })
    this._updateService = params.updateService
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
