import { LifeCycle } from '@beecode/msh-app-boot'

import { ipcRouter } from '#src/main/controller/ipc/router'

export class IpcRegistrationLifeCycle extends LifeCycle<void> {
  constructor() {
    super({ name: 'ipc registration' })
  }

  protected _createFn(): Promise<void> {
    ipcRouter.register()

    return Promise.resolve()
  }

  protected _destroyFn(): Promise<void> {
    ipcRouter.unregister()

    return Promise.resolve()
  }
}
