import { singletonPattern } from '@beecode/msh-util'
import { type BrowserWindow } from 'electron'

export class _AppWindowStore {
  protected _window?: BrowserWindow

  setWindow(params: { window: BrowserWindow }): void {
    const { window } = params
    this._window = window
  }

  closeWindow(): void {
    const window = this._window
    this._window = undefined

    if (window === undefined || window.isDestroyed()) {
      return
    }

    window.close()
  }

  sendToRenderer(params: { channel: string; payload: unknown }): void {
    const { channel, payload } = params
    if (this._window === undefined || this._window.isDestroyed()) {
      return
    }

    this._window.webContents.send(channel, payload)
  }
}

export const appWindowStoreSingleton = singletonPattern(() => {
  return new _AppWindowStore()
})
