import { singletonPattern } from '@beecode/msh-util'

import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { appEventBusSingleton } from '#src/main/business/service/app-event-bus-singleton'
import { SettingsService } from '#src/main/business/service/settings-service'
import { SettingsDal } from '#src/main/dal/settings-dal'
import { type AppSettings } from '#src/shared/business/model/settings-model'

export interface ISettingsDal {
  readSettings: () => Promise<unknown>
  writeSettings: (params: { settings: AppSettings }) => Promise<void>
}

export class _SettingsRepo {
  protected readonly _dal: ISettingsDal = new SettingsDal()

  async load(): Promise<AppSettings> {
    const rawSettings = await this._dal.readSettings()

    if (rawSettings === undefined) {
      return new SettingsService().createDefaultSettings()
    }

    return new SettingsService().sanitizeSettings({ rawSettings })
  }

  async save(params: { settings: AppSettings }): Promise<void> {
    const { settings } = params
    await this._dal.writeSettings({ settings })
    appEventBusSingleton().emit({ payload: settings, type: AppEventType.SETTINGS_SAVED })
  }
}

export const settingsRepoSingleton = singletonPattern(() => {
  return new _SettingsRepo()
})
