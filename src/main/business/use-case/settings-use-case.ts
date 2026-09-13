import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { schedulingServiceSingleton } from '#src/main/business/service/scheduling-service-singleton'
import { sessionsPollServiceSingleton } from '#src/main/business/service/sessions-poll-service-singleton'
import { SettingsService } from '#src/main/business/service/settings-service'
import { usagePollServiceSingleton } from '#src/main/business/service/usage-poll-service-singleton'
import { type AppSettings } from '#src/shared/business/model/settings-model'

export const settingsUseCase = {
  loadSettings: async (): Promise<AppSettings> => {
    return await settingsRepoSingleton().load()
  },

  saveSettings: async (params: { rawSettings: unknown }): Promise<AppSettings> => {
    const { rawSettings } = params
    const settings = new SettingsService().sanitizeSettings({ rawSettings })

    await settingsRepoSingleton().save({ settings })
    await usagePollServiceSingleton().restart({ settings })
    await sessionsPollServiceSingleton().restart({ settings })
    await schedulingServiceSingleton().syncRegistrations({ settings })

    return settings
  },

  setSchedulingEnabled: async (params: { isEnabled: boolean }): Promise<AppSettings> => {
    const { isEnabled } = params
    const settings = await settingsRepoSingleton().load()
    const nextSettings = new SettingsService().setSchedulingEnabled({ isEnabled, settings })

    await settingsRepoSingleton().save({ settings: nextSettings })
    await schedulingServiceSingleton().syncRegistrations({ settings: nextSettings })

    return nextSettings
  },

  setTrackerPaused: async (params: { isAutoRefreshPaused: boolean; trackerId: string }): Promise<AppSettings> => {
    const { isAutoRefreshPaused, trackerId } = params
    const settings = await settingsRepoSingleton().load()
    const nextSettings = new SettingsService().setTrackerPaused({
      isAutoRefreshPaused,
      settings,
      trackerId,
    })

    await settingsRepoSingleton().save({ settings: nextSettings })
    await usagePollServiceSingleton().applyTrackerAutoRefresh({ settings: nextSettings, trackerId })
    void schedulingServiceSingleton()
      .syncRegistrations({ settings: nextSettings })
      .catch(() => {
        return undefined
      })

    return nextSettings
  },

  setTriggerEnabled: async (params: { isEnabled: boolean; triggerId: string }): Promise<AppSettings> => {
    const { isEnabled, triggerId } = params
    const settings = await settingsRepoSingleton().load()
    const nextSettings = new SettingsService().setTriggerEnabled({
      isEnabled,
      settings,
      triggerId,
    })

    await settingsRepoSingleton().save({ settings: nextSettings })
    await schedulingServiceSingleton().syncRegistrations({ settings: nextSettings })

    return nextSettings
  },
}
