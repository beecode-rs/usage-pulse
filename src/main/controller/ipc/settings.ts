import { type IpcMainInvokeEvent } from 'electron'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { type SettingsModel } from '#src/shared/business/model/settings-model'

export const ipcSettings = {
  get: (): SettingsModel => {
    return settingsRepoSingleton().fetch()
  },

  save: async (_event: IpcMainInvokeEvent, rawSettings: unknown): Promise<SettingsModel> => {
    const settings = settingsRepoSingleton().sanitize({ rawSettings })

    await settingsRepoSingleton().save({ settings })

    return settings
  },
}
