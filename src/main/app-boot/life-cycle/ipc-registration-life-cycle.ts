import { LifeCycle } from '@beecode/msh-app-boot'

import { ipcRouterSingleton } from '#src/main/controller/ipc/router'

export class IpcRegistrationLifeCycle extends LifeCycle<void> {
  constructor() {
    super({ name: 'ipc registration' })
  }

  protected _createFn(): Promise<void> {
    ipcRouterSingleton().register()

    return Promise.resolve()
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
