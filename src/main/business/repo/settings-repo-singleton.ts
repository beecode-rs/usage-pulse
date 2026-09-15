import { singletonPattern } from '@beecode/msh-util'

import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { appSettingsSchema } from '#src/main/business/schema/settings-schema'
import { appEventBusSingleton } from '#src/main/business/service/app-event-bus-singleton'
import { SettingsDal } from '#src/main/dal/settings-dal'
import { idUtil } from '#src/main/util/id-util'
import { objectUtil } from '#src/main/util/object-util'
import { SettingsModel } from '#src/shared/business/model/settings-model'

export interface ISettingsDal {
  readSettings: () => SettingsModel | undefined
  readSettingsFile: () => Promise<unknown>
  writeSettings: (params: { settings: SettingsModel }) => Promise<void>
}

export class _SettingsRepo {
  protected readonly _dal: ISettingsDal = new SettingsDal()

  fetch(): SettingsModel {
    const settings = this._dal.readSettings()

    if (settings === undefined) {
      throw new Error('settings are not initialized')
    }

    return new SettingsModel({ settings })
  }

  async init(): Promise<void> {
    const settings = this.sanitize({ rawSettings: await this._dal.readSettingsFile() })
    await this._dal.writeSettings({ settings })
  }

  async save(params: { settings: SettingsModel }): Promise<void> {
    const { settings } = params
    await this._dal.writeSettings({ settings })
    appEventBusSingleton().emit({ payload: settings, type: AppEventType.SETTINGS_SAVED })
  }

  sanitize(params: { rawSettings: unknown }): SettingsModel {
    const { rawSettings } = params
    const rawRecord = objectUtil.asRecord(rawSettings)

    if (rawRecord === undefined) {
      return new SettingsModel()
    }

    const sanitizedSettings = appSettingsSchema.parse(rawRecord)

    return new SettingsModel({
      settings: {
        ...sanitizedSettings,
        sshHosts: idUtil.ensureUniqueIds(sanitizedSettings.sshHosts),
        trackers: idUtil.ensureUniqueIds(sanitizedSettings.trackers),
        triggers: idUtil.ensureUniqueIds(sanitizedSettings.triggers),
      },
    })
  }
}

export const settingsRepoSingleton = singletonPattern(() => {
  return new _SettingsRepo()
})
