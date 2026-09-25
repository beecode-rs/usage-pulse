import { type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { usagePollServiceSingleton } from '#src/main/business/service/usage-poll-service-singleton'
import { validationUtil } from '#src/main/util/validation-util'
import { type SettingsModel } from '#src/shared/business/model/settings-model'
import { type UsageSnapshot } from '#src/shared/business/model/usage-model'

const usageRefreshTrackerParamsSchema = z.string()
const usageSetTrackerPausedParamsSchema = z.object({ isAutoRefreshPaused: z.boolean(), trackerId: z.string() })

export const ipcUsage = {
  getSnapshot: (): UsageSnapshot => {
    return usagePollServiceSingleton().getSnapshot()
  },

  refresh: async (): Promise<void> => {
    await usagePollServiceSingleton().refreshNow()
  },

  refreshTracker: async (_event: IpcMainInvokeEvent, rawTrackerId: unknown): Promise<void> => {
    const trackerId = validationUtil.parse(rawTrackerId, usageRefreshTrackerParamsSchema)

    await usagePollServiceSingleton().refreshTracker({ trackerId })
  },

  setTrackerPaused: async (_event: IpcMainInvokeEvent, rawParams: unknown): Promise<SettingsModel> => {
    const { isAutoRefreshPaused, trackerId } = validationUtil.parse(rawParams, usageSetTrackerPausedParamsSchema)
    const settings = settingsRepoSingleton().fetch().withTrackerPaused({ isAutoRefreshPaused, trackerId })

    await settingsRepoSingleton().save({ settings })

    return settings
  },
}
