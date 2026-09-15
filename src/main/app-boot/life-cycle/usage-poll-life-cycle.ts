import { LifeCycle } from '@beecode/msh-app-boot'

import { usagePollServiceSingleton } from '#src/main/business/service/usage-poll-service-singleton'

export class UsagePollLifeCycle extends LifeCycle<void> {
  protected readonly _pollService = usagePollServiceSingleton()

  constructor() {
    super({ name: 'usage poll' })
  }

  protected async _createFn(): Promise<void> {
    await this._pollService.start()
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
