import { LifeCycle } from '@beecode/msh-app-boot'

import { rxjsBusRouterSingleton } from '#src/main/controller/rxjs-bus/router'

export class RxjsBusLifeCycle extends LifeCycle<void> {
  constructor() {
    super({ name: 'rxjs bus' })
  }

  protected _createFn(): Promise<void> {
    rxjsBusRouterSingleton().register()

    return Promise.resolve()
  }

  protected _destroyFn(): Promise<void> {
    rxjsBusRouterSingleton().unregister()

    return Promise.resolve()
  }
}
