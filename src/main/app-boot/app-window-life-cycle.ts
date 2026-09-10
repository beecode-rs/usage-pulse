import { LifeCycle } from '@beecode/msh-app-boot'
import { type BrowserWindow } from 'electron'

import { AppWindow, type WindowVisibilityChangeListener } from '#src/main/lib/app-window'

export class AppWindowLifeCycle extends LifeCycle<void> {
  protected readonly _onVisibilityChange?: WindowVisibilityChangeListener
  protected _window?: BrowserWindow

  constructor(params: { onVisibilityChange?: WindowVisibilityChangeListener }) {
    super({ name: 'app window' })
    this._onVisibilityChange = params.onVisibilityChange
  }

  getWindow(): BrowserWindow {
    if (this._window === undefined) {
      throw new Error('app window is not created')
    }

    return this._window
  }

  protected _createFn(): Promise<void> {
    this._window = new AppWindow().create({ onVisibilityChange: this._onVisibilityChange })

    return Promise.resolve()
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
