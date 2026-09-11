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
    return window.usageApi.refreshTracker({ trackerId: params.trackerId })
  },
  saveSettings: (params: { settings: AppSettings }): Promise<AppSettings> => {
    return window.usageApi.saveSettings(params.settings)
  },
  setTrackerPaused: (params: { isAutoRefreshPaused: boolean; trackerId: string }): Promise<AppSettings> => {
    return window.usageApi.setTrackerPaused({
      isAutoRefreshPaused: params.isAutoRefreshPaused,
      trackerId: params.trackerId,
    })
  },
  subscribeToSettingsUpdates: (params: { onUpdate: SettingsUpdateListener }): (() => void) => {
    return window.usageApi.onSettingsUpdate(params.onUpdate)
  },
  subscribeToUsageUpdates: (params: { onUpdate: UsageUpdateListener }): (() => void) => {
    return window.usageApi.onUsageUpdate(params.onUpdate)
  },
}
