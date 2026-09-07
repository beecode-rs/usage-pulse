import { app } from 'electron'
import { join } from 'node:path'

import { type ISettingsDal } from '#src/main/business/repo/settings-repo-singleton'
import { CommonFileDal } from '#src/main/dal/common-file-dal'
import { CommonMemoryDal } from '#src/main/dal/common-memory-dal'
import { type SettingsModel } from '#src/shared/business/model/settings-model'

export class SettingsDal extends CommonFileDal implements ISettingsDal {
  protected readonly _memoryDal = new CommonMemoryDal<SettingsModel>()
  protected readonly _settingsFilePath?: string

  constructor(params?: { settingsFilePath?: string }) {
    super()
    const { settingsFilePath } = params ?? {}
    this._settingsFilePath = settingsFilePath
  }

  readSettings(): SettingsModel | undefined {
    return this._memoryDal.readValue()
  }

  async readSettingsFile(): Promise<unknown> {
    return await this._readJsonFile({ filePath: this._resolveSettingsFilePath() })
  }

  async writeSettings(params: { settings: SettingsModel }): Promise<void> {
    const { settings } = params
    this._memoryDal.writeValue({ value: settings })
    await this._writeJsonFile({ content: settings, filePath: this._resolveSettingsFilePath() })
  }

  protected _resolveSettingsFilePath(): string {
    return this._settingsFilePath ?? join(app.getPath('userData'), 'usage-pulse-settings.json')
  }
}
