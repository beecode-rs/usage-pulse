import { type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { TriggerRunLogRepo } from '#src/main/business/repo/trigger-run-log-repo'
import { schedulingServiceSingleton } from '#src/main/business/service/scheduling-service-singleton'
import { validationUtil } from '#src/main/util/validation-util'
import {
  type ScheduleTriggerRegistrationHealth,
  type ScheduleTriggerRunLogEntry,
} from '#src/shared/business/model/schedule-trigger-model'
import { type SettingsModel } from '#src/shared/business/model/settings-model'

const triggerRunLogsParamsSchema = z.object({ triggerId: z.string() })
const triggerSetEnabledParamsSchema = z.object({ isEnabled: z.boolean(), triggerId: z.string() })

export const ipcTrigger = {
  clearRunLogs: async (_event: IpcMainInvokeEvent, rawParams: unknown): Promise<void> => {
    const { triggerId } = validationUtil.parse(rawParams, triggerRunLogsParamsSchema)

    await new TriggerRunLogRepo().removeByTriggerId({ triggerId })
  },

  getRunLogs: async (_event: IpcMainInvokeEvent, rawParams: unknown): Promise<ScheduleTriggerRunLogEntry[]> => {
    const { triggerId } = validationUtil.parse(rawParams, triggerRunLogsParamsSchema)

    return await new TriggerRunLogRepo().listByTriggerId({ triggerId })
  },

  inspectRegistrations: async (): Promise<ScheduleTriggerRegistrationHealth[]> => {
    return await schedulingServiceSingleton().inspectRegistrations()
  },

  setEnabled: async (_event: IpcMainInvokeEvent, rawParams: unknown): Promise<SettingsModel> => {
    const { isEnabled, triggerId } = validationUtil.parse(rawParams, triggerSetEnabledParamsSchema)
    const settings = settingsRepoSingleton().fetch().withTriggerEnabled({ isEnabled, triggerId })

    await settingsRepoSingleton().save({ settings })

    return settings
  },
}
