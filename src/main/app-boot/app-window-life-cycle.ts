import { LifeCycle } from '@beecode/msh-app-boot'

import { AppWindow, type WindowVisibilityChangeListener } from '#src/main/lib/app-window'
import { appWindowStoreSingleton } from '#src/main/lib/app-window-store-singleton'

export class AppWindowLifeCycle extends LifeCycle<void> {
  protected readonly _onVisibilityChange?: WindowVisibilityChangeListener

  constructor(params: { onVisibilityChange?: WindowVisibilityChangeListener }) {
    const { onVisibilityChange } = params
    super({ name: 'app window' })
    this._onVisibilityChange = onVisibilityChange
  }

  protected _createFn(): Promise<void> {
    const browserWindow = new AppWindow().create({ onVisibilityChange: this._onVisibilityChange })

    appWindowStoreSingleton().setWindow({ window: browserWindow })

    return Promise.resolve()
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
