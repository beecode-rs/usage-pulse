import { LifeCycle } from '@beecode/msh-app-boot'

import { IpcRouter } from '#src/main/controller/ipc/router'

export class IpcRegistrationLifeCycle extends LifeCycle<void> {
  constructor() {
    super({ name: 'ipc registration' })
  }

  protected _createFn(): Promise<void> {
    new IpcRouter().register()

    return Promise.resolve()
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
