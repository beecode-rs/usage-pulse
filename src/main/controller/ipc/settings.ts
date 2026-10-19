import { type IpcMainInvokeEvent } from 'electron'
import { type ZodError } from 'zod'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { appSettingsStrictSchema } from '#src/main/business/schema/settings-schema'
import { validationUtil } from '#src/main/util/validation-util'
import { type SettingsData, type SettingsModel } from '#src/shared/business/model/settings-model'

const resolveStrictParseErrorMessage = (error: ZodError): string => {
  return error.issues
    .map((issue) => {
      return `${issue.path.join('.')}: ${issue.message}`
    })
    .join('; ')
}

const parseStrictSettings = (rawSettings: unknown): SettingsData => {
  const parsedSettings = validationUtil.safeParse(rawSettings, appSettingsStrictSchema)

  if (!parsedSettings.success) {
    throw new Error(`Invalid settings: ${resolveStrictParseErrorMessage(parsedSettings.error)}`)
  }

  return parsedSettings.data
}

export const ipcSettings = {
  get: (): SettingsModel => {
    return settingsRepoSingleton().fetch()
  },

  save: async (_event: IpcMainInvokeEvent, rawSettings: unknown): Promise<SettingsModel> => {
    return await settingsRepoSingleton().saveExternal({ settings: parseStrictSettings(rawSettings) })
  },
}
