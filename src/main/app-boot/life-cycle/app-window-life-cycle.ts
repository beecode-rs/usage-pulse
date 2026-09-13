import { LifeCycle } from '@beecode/msh-app-boot'

import { sessionsPollServiceSingleton } from '#src/main/business/service/sessions-poll-service-singleton'
import { usagePollServiceSingleton } from '#src/main/business/service/usage-poll-service-singleton'
import { AppWindow } from '#src/main/lib/app-window'
import { appWindowStoreSingleton } from '#src/main/lib/app-window-store-singleton'

export class AppWindowLifeCycle extends LifeCycle<void> {
  constructor() {
    super({ name: 'app window' })
  }

  protected _createFn(): Promise<void> {
    const browserWindow = new AppWindow().create({
      onVisibilityChange: ({ isVisible }) => {
        usagePollServiceSingleton().setWindowVisibility({ isVisible })
        sessionsPollServiceSingleton().setWindowVisibility({ isVisible })
      },
    })

    appWindowStoreSingleton().setWindow({ window: browserWindow })

    return Promise.resolve()
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
