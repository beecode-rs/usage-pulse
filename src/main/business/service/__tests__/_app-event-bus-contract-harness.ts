import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { appEventBusSingleton } from '#src/main/business/service/app-event-bus-singleton'
import { type SessionSnapshot } from '#src/shared/business/model/session-model'
import { type SettingsModel } from '#src/shared/business/model/settings-model'
import { type UpdateStatus } from '#src/shared/business/model/update-model'
import { type UsageSnapshot } from '#src/shared/business/model/usage-model'

export const appEventBusContractHarness = {
  isSameBusInstanceAcrossSingletonCalls: (): boolean => {
    return appEventBusSingleton() === appEventBusSingleton()
  },
  sessionsSnapshotDeliveriesAfterUsageSnapshotEmit: (params: { message: UsageSnapshot }): SessionSnapshot[] => {
    const { message } = params
    const deliveries: SessionSnapshot[] = []
    const subscription = appEventBusSingleton().subscribe({
      listener: (snapshot) => {
        deliveries.push(snapshot)
      },
      type: AppEventType.SESSIONS_SNAPSHOT,
    })
    appEventBusSingleton().emit({ payload: message, type: AppEventType.USAGE_SNAPSHOT })
    subscription.unsubscribe()

    return deliveries
  },
  sessionsSnapshotRoundTrip: (params: { message: SessionSnapshot }): SessionSnapshot[] => {
    const { message } = params
    const deliveries: SessionSnapshot[] = []
    const subscription = appEventBusSingleton().subscribe({
      listener: (snapshot) => {
        deliveries.push(snapshot)
      },
      type: AppEventType.SESSIONS_SNAPSHOT,
    })
    appEventBusSingleton().emit({ payload: message, type: AppEventType.SESSIONS_SNAPSHOT })
    subscription.unsubscribe()

    return deliveries
  },
  settingsSavedRoundTrip: (params: { message: SettingsModel }): SettingsModel[] => {
    const { message } = params
    const deliveries: SettingsModel[] = []
    const subscription = appEventBusSingleton().subscribe({
      listener: (settings) => {
        deliveries.push(settings)
      },
      type: AppEventType.SETTINGS_SAVED,
    })
    appEventBusSingleton().emit({ payload: message, type: AppEventType.SETTINGS_SAVED })
    subscription.unsubscribe()

    return deliveries
  },
  updateStatusRoundTrip: (params: { message: UpdateStatus }): UpdateStatus[] => {
    const { message } = params
    const deliveries: UpdateStatus[] = []
    const subscription = appEventBusSingleton().subscribe({
      listener: (status) => {
        deliveries.push(status)
      },
      type: AppEventType.UPDATE_STATUS,
    })
    appEventBusSingleton().emit({ payload: message, type: AppEventType.UPDATE_STATUS })
    subscription.unsubscribe()

    return deliveries
  },
  usageSnapshotRoundTrip: (params: { message: UsageSnapshot }): UsageSnapshot[] => {
    const { message } = params
    const deliveries: UsageSnapshot[] = []
    const subscription = appEventBusSingleton().subscribe({
      listener: (snapshot) => {
        deliveries.push(snapshot)
      },
      type: AppEventType.USAGE_SNAPSHOT,
    })
    appEventBusSingleton().emit({ payload: message, type: AppEventType.USAGE_SNAPSHOT })
    subscription.unsubscribe()

    return deliveries
  },
}
