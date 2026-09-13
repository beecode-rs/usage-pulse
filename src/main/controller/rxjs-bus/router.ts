import { singletonPattern } from '@beecode/msh-util'

import { rxjsBusIpcForwarder } from '#src/main/controller/rxjs-bus/ipc-forwarder'

export class RxjsBusRouter {
  protected readonly _subscriptions: { unsubscribe: () => void }[] = []

  register(): void {
    this._subscriptions.push(...rxjsBusIpcForwarder.register())
  }

  unregister(): void {
    this._subscriptions.forEach((subscription) => {
      subscription.unsubscribe()
    })
    this._subscriptions.length = 0
  }
}

export const rxjsBusRouterSingleton = singletonPattern(() => {
  return new RxjsBusRouter()
})
