import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SettingsDal } from '#src/main/dal/settings-dal'
import { type SettingsModel } from '#src/shared/business/model/settings-model'

const resolveTempSettingsFilePath = (): string => {
  return join(mkdtempSync(join(tmpdir(), 'settings-dal-')), 'settings.json')
}

export const settingsDalContractHarness = {
  parsedFileContentAfterWrite: async (params: { settings: SettingsModel }): Promise<SettingsModel> => {
    const { settings } = params
    const settingsFilePath = resolveTempSettingsFilePath()
    const dal = new SettingsDal({ settingsFilePath })
    await dal.writeSettings({ settings })
    const rawFileContent = readFileSync(settingsFilePath, 'utf8')

    return JSON.parse(rawFileContent) as SettingsModel
  },
  readSettingsAfterSecondWrite: async (params: {
    firstSettings: SettingsModel
    secondSettings: SettingsModel
  }): Promise<SettingsModel | undefined> => {
    const { firstSettings, secondSettings } = params
    const dal = new SettingsDal({ settingsFilePath: resolveTempSettingsFilePath() })
    await dal.writeSettings({ settings: firstSettings })
    await dal.writeSettings({ settings: secondSettings })

    return dal.readSettings()
  },
  readSettingsAfterWrite: async (params: { settings: SettingsModel }): Promise<SettingsModel | undefined> => {
    const { settings } = params
    const dal = new SettingsDal({ settingsFilePath: resolveTempSettingsFilePath() })
    await dal.writeSettings({ settings })

    return dal.readSettings()
  },
  readSettingsBeforeWrite: (): SettingsModel | undefined => {
    return new SettingsDal({ settingsFilePath: resolveTempSettingsFilePath() }).readSettings()
  },
  readSettingsFileAfterWrite: async (params: { settings: SettingsModel }): Promise<unknown> => {
    const { settings } = params
    const dal = new SettingsDal({ settingsFilePath: resolveTempSettingsFilePath() })
    await dal.writeSettings({ settings })

    return await dal.readSettingsFile()
  },
  readSettingsFileOnMissingFile: async (): Promise<unknown> => {
    return await new SettingsDal({ settingsFilePath: resolveTempSettingsFilePath() }).readSettingsFile()
  },
}
