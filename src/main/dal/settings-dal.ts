import { app } from 'electron'
import { join } from 'node:path'

import { type ISettingsDal } from '#src/main/business/repo/settings-repo-singleton'
import { FileDal } from '#src/main/dal/file-dal'
import { type AppSettings } from '#src/shared/business/model/settings-model'

export class SettingsDal extends FileDal implements ISettingsDal {
  protected readonly _settingsFilePath: string

  constructor(params?: { settingsFilePath?: string }) {
    super()
    const { settingsFilePath = join(app.getPath('userData'), 'usage-pulse-settings.json') } = params ?? {}
    this._settingsFilePath = settingsFilePath
  }

  async readSettings(): Promise<unknown> {
    return await this._readJsonFile({ filePath: this._settingsFilePath })
  }

  async writeSettings(params: { settings: AppSettings }): Promise<void> {
    const { settings } = params
    await this._writeJsonFile({ content: settings, filePath: this._settingsFilePath })
  }
}
