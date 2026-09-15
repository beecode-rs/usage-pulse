import { LifeCycle } from '@beecode/msh-app-boot'

import { sessionsPollServiceSingleton } from '#src/main/business/service/sessions-poll-service-singleton'

export class SessionsPollLifeCycle extends LifeCycle<void> {
  protected readonly _sessionsPollService = sessionsPollServiceSingleton()

  constructor() {
    super({ name: 'sessions poll' })
  }

  protected async _createFn(): Promise<void> {
    await this._sessionsPollService.start()
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
