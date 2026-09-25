import { type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { schedulingServiceSingleton } from '#src/main/business/service/scheduling-service-singleton'
import { validationUtil } from '#src/main/util/validation-util'
import { type SchedulingInfo } from '#src/shared/business/model/schedule-trigger-model'
import { type SettingsModel } from '#src/shared/business/model/settings-model'

const schedulingSetEnabledParamsSchema = z.object({ isEnabled: z.boolean() })

export const ipcScheduling = {
  getInfo: (): SchedulingInfo => {
    return schedulingServiceSingleton().getSchedulingInfo()
  },

  setEnabled: async (_event: IpcMainInvokeEvent, rawParams: unknown): Promise<SettingsModel> => {
    const { isEnabled } = validationUtil.parse(rawParams, schedulingSetEnabledParamsSchema)
    const settings = settingsRepoSingleton().fetch().withSchedulingEnabled({ isEnabled })

    await settingsRepoSingleton().save({ settings })

    return settings
  },
}
