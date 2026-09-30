import { LifeCycle } from '@beecode/msh-app-boot'

import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { mobileServerServiceSingleton } from '#src/main/business/service/mobile-server-service-singleton'
import { appEventBusSingleton } from '#src/main/lib/app-event-bus-singleton'
import { type SettingsModel } from '#src/shared/business/model/settings-model'

export class MobileServerLifeCycle extends LifeCycle<void> {
  protected _appliedPort: number | undefined
  protected _isServerActive = false
  protected readonly _mobileServerService = mobileServerServiceSingleton()
  protected readonly _settingsRepo = settingsRepoSingleton()
  protected _settingsSavedSubscription: { unsubscribe: () => void } | undefined

  constructor() {
    super({ name: 'mobile server' })
  }

  protected async _createFn(): Promise<void> {
    this._settingsSavedSubscription = appEventBusSingleton().subscribe({
      listener: (settings) => {
        void this._syncServerState({ settings }).catch(() => {
          return undefined
        })
      },
      type: AppEventType.SETTINGS_SAVED,
    })

    const settings = this._settingsRepo.fetch()

    if (!settings.isMobileServerEnabled) {
      return
    }

    await this._startServer({ port: settings.mobileServerPort })
  }

  protected async _destroyFn(): Promise<void> {
    this._settingsSavedSubscription?.unsubscribe()
    this._settingsSavedSubscription = undefined
    await this._stopServer()
  }

  protected _isRestartRequired(params: { port: number }): boolean {
    const { port } = params

    if (!this._isServerActive) {
      return true
    }

    if (this._mobileServerService.isFailed()) {
      return true
    }

    return port !== this._appliedPort
  }

  protected async _startServer(params: { port: number }): Promise<void> {
    const { port } = params
    await this._mobileServerService.start()
    this._appliedPort = port
    this._isServerActive = true
  }

  protected async _stopServer(): Promise<void> {
    await this._mobileServerService.stop()
    this._appliedPort = undefined
    this._isServerActive = false
  }

  protected async _syncServerState(params: { settings: SettingsModel }): Promise<void> {
    const { settings } = params

    if (!settings.isMobileServerEnabled) {
      await this._stopServer()

      return
    }

    const isRestartRequired = this._isRestartRequired({ port: settings.mobileServerPort })

    if (!isRestartRequired) {
      return
    }

    await this._startServer({ port: settings.mobileServerPort })
  }
}
