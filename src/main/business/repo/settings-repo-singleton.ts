import { singletonPattern } from '@beecode/msh-util'
import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { SettingsService } from '#src/main/business/service/settings-service'
import { type AppSettings } from '#src/shared/business/model/settings-model'

export type SettingsSaveListener = (params: { settings: AppSettings }) => void

export class _SettingsRepo {
  protected readonly _saveListeners: SettingsSaveListener[] = []
  protected readonly _settingsFilePath: string

  constructor(params: { settingsFilePath: string }) {
    const { settingsFilePath } = params
    this._settingsFilePath = settingsFilePath
  }

  async load(): Promise<AppSettings> {
    const fileContent = await this._readFileContent()

    if (fileContent === undefined) {
      return new SettingsService().createDefaultSettings()
    }

    return new SettingsService().sanitizeSettings({ rawSettings: this._parseJsonContent({ content: fileContent }) })
  }

  onSave(params: { listener: SettingsSaveListener }): void {
    const { listener } = params
    this._saveListeners.push(listener)
  }

  async save(params: { settings: AppSettings }): Promise<void> {
    const { settings } = params
    await mkdir(dirname(this._settingsFilePath), { recursive: true })
    await writeFile(this._settingsFilePath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
    this._notifySaveListeners({ settings })
  }

  protected _notifySaveListeners(params: { settings: AppSettings }): void {
    const { settings } = params
    this._saveListeners.forEach((listener) => {
      listener({ settings })
    })
  }

  protected async _readFileContent(): Promise<string | undefined> {
    try {
      return await readFile(this._settingsFilePath, 'utf8')
    } catch (error) {
      if (this._isNotFoundError(error)) {
        return undefined
      }

      throw error
    }
  }

  protected _isNotFoundError(error: unknown): boolean {
    const errnoException = error as NodeJS.ErrnoException

    return errnoException.code === 'ENOENT'
  }

  protected _parseJsonContent(params: { content: string }): unknown {
    const { content } = params
    try {
      return JSON.parse(content)
    } catch {
      return undefined
    }
  }
}

export const settingsRepoSingleton = singletonPattern(() => {
  return new _SettingsRepo({
    settingsFilePath: join(app.getPath('userData'), 'usage-pulse-settings.json'),
  })
})
