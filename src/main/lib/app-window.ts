import { BrowserWindow, app, shell } from 'electron'
import { join } from 'node:path'

import { config } from '#src/main/util/config'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'

export type WindowVisibilityChangeListener = (params: { isVisible: boolean }) => void

export class AppWindow {
  create(params?: { onVisibilityChange?: WindowVisibilityChangeListener }): BrowserWindow {
    const { onVisibilityChange } = params ?? {}
    this._setDevelopmentDockIcon()

    const browserWindow = new BrowserWindow({
      height: 680,
      icon: this._resolveWindowIconPath(),
      minHeight: 560,
      minWidth: 760,
      show: false,
      title: 'Usage Pulse',
      webPreferences: {
        contextIsolation: true,
        preload: join(__dirname, '../preload/index.mjs'),
        sandbox: false,
      },
      width: 1000,
    })

    browserWindow.on('ready-to-show', () => {
      browserWindow.show()
    })

    if (onVisibilityChange !== undefined) {
      this._watchVisibility({ browserWindow, onVisibilityChange })
    }

    browserWindow.webContents.setWindowOpenHandler((details) => {
      void shell.openExternal(details.url)

      return { action: 'deny' }
    })

    const rendererUrl = config.rendererUrl

    if (rendererUrl !== undefined) {
      void browserWindow.loadURL(rendererUrl)
    } else {
      void browserWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    return browserWindow
  }

  protected _resolveWindowIconPath(): string | undefined {
    switch (osUtil.resolvePlatform()) {
      case OS.LINUX: {
        return join(__dirname, '../../build/icons/512x512.png')
      }
      case OS.WINDOWS: {
        return join(__dirname, '../../build/icons/256x256.png')
      }
      default: {
        return undefined
      }
    }
  }

  protected _setDevelopmentDockIcon(): void {
    if (app.isPackaged || osUtil.resolvePlatform() !== OS.MACOS) {
      return
    }

    app.dock?.setIcon(join(__dirname, '../../build/icons/512x512.png'))
  }

  protected _watchVisibility(params: {
    browserWindow: BrowserWindow
    onVisibilityChange: WindowVisibilityChangeListener
  }): void {
    const { browserWindow, onVisibilityChange } = params
    const notifyVisible = (): void => {
      onVisibilityChange({ isVisible: true })
    }

    const notifyHidden = (): void => {
      onVisibilityChange({ isVisible: false })
    }

    browserWindow.on('show', notifyVisible)
    browserWindow.on('restore', notifyVisible)
    browserWindow.on('hide', notifyHidden)
    browserWindow.on('minimize', notifyHidden)
  }
}
