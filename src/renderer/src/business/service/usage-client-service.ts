import type { AppSettings } from '#src/shared/business/model/settings-model'
import type { SettingsUpdateListener, UsageSnapshot, UsageUpdateListener } from '#src/shared/business/model/usage-model'

export const usageClientService = {
  getSettings: (): Promise<AppSettings> => {
    return window.usageApi.getSettings()
  },
  getSnapshot: (): Promise<UsageSnapshot> => {
    return window.usageApi.getSnapshot()
  },
  refreshNow: (): Promise<void> => {
    return window.usageApi.refreshNow()
  },
  refreshTracker: (params: { trackerId: string }): Promise<void> => {
    const { trackerId } = params

    return window.usageApi.refreshTracker({ trackerId })
  },
  saveSettings: (params: { settings: AppSettings }): Promise<AppSettings> => {
    const { settings } = params

    return window.usageApi.saveSettings(settings)
  },
  setTrackerPaused: (params: { isAutoRefreshPaused: boolean; trackerId: string }): Promise<AppSettings> => {
    const { isAutoRefreshPaused, trackerId } = params

    return window.usageApi.setTrackerPaused({
      isAutoRefreshPaused,
      trackerId,
    })
  },
  subscribeToSettingsUpdates: (params: { onUpdate: SettingsUpdateListener }): (() => void) => {
    const { onUpdate } = params

    return window.usageApi.onSettingsUpdate(onUpdate)
  },
  subscribeToUsageUpdates: (params: { onUpdate: UsageUpdateListener }): (() => void) => {
    const { onUpdate } = params

    return window.usageApi.onUsageUpdate(onUpdate)
  },
}
