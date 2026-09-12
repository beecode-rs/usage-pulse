import { LifeCycle } from '@beecode/msh-app-boot'

import { IpcController } from '#src/main/controller/ipc-controller'

export class IpcRegistrationLifeCycle extends LifeCycle<void> {
  protected readonly _ipcController = new IpcController()

  constructor() {
    super({ name: 'ipc registration' })
  }

  protected _createFn(): Promise<void> {
    this._ipcController.register()

    return Promise.resolve()
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
