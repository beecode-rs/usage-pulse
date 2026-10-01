import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { _MobileDerivedEventsService } from '#src/main/business/service/mobile-derived-events-service-singleton'
import { appEventBusSingleton } from '#src/main/lib/app-event-bus-singleton'
import { type UsageWarning } from '#src/shared/business/model/mobile-api-model'
import { type SessionInfo, type SessionSnapshot } from '#src/shared/business/model/session-model'
import { type UsageSnapshot } from '#src/shared/business/model/usage-model'

export const mobileDerivedEventsServiceContractHarness = {
  sessionFinishedDeliveries(params: { snapshots: SessionSnapshot[] }): SessionInfo[] {
    const { snapshots } = params
    const deliveries: SessionInfo[] = []
    const subscription = appEventBusSingleton().subscribe({
      listener: (session) => {
        deliveries.push(session)
      },
      type: AppEventType.SESSION_FINISHED,
    })
    const service = new _MobileDerivedEventsService()
    service.start()
    snapshots.forEach((snapshot) => {
      appEventBusSingleton().emit({ payload: snapshot, type: AppEventType.SESSIONS_SNAPSHOT })
    })
    service.stop()
    subscription.unsubscribe()

    return deliveries
  },
  sessionWaitingDeliveries(params: { snapshots: SessionSnapshot[] }): SessionInfo[] {
    const { snapshots } = params
    const deliveries: SessionInfo[] = []
    const subscription = appEventBusSingleton().subscribe({
      listener: (session) => {
        deliveries.push(session)
      },
      type: AppEventType.SESSION_WAITING,
    })
    const service = new _MobileDerivedEventsService()
    service.start()
    snapshots.forEach((snapshot) => {
      appEventBusSingleton().emit({ payload: snapshot, type: AppEventType.SESSIONS_SNAPSHOT })
    })
    service.stop()
    subscription.unsubscribe()

    return deliveries
  },

  usageWarningDeliveries(params: { snapshots: UsageSnapshot[] }): UsageWarning[] {
    const { snapshots } = params
    const deliveries: UsageWarning[] = []
    const subscription = appEventBusSingleton().subscribe({
      listener: (warning) => {
        deliveries.push(warning)
      },
      type: AppEventType.USAGE_WARNING,
    })
    const service = new _MobileDerivedEventsService()
    service.start()
    snapshots.forEach((snapshot) => {
      appEventBusSingleton().emit({ payload: snapshot, type: AppEventType.USAGE_SNAPSHOT })
    })
    service.stop()
    subscription.unsubscribe()

    return deliveries
  },
}
