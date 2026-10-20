import { LifeCycle } from '@beecode/msh-app-boot'

import { mobileServerServiceSingleton } from '#src/main/business/service/mobile-server-service-singleton'

export class MobileServerLifeCycle extends LifeCycle<void> {
  protected readonly _mobileServerService = mobileServerServiceSingleton()

  constructor() {
    super({ name: 'mobile server' })
  }

  protected async _createFn(): Promise<void> {
    await this._mobileServerService.start()
  }

  protected async _destroyFn(): Promise<void> {
    await this._mobileServerService.stop()
  }
}
