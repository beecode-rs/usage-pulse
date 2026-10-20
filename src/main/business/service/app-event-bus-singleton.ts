import { singletonPattern } from '@beecode/msh-util'
import { Subject } from 'rxjs'

import { type AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { type MobileConnectedDevice, type UsageWarning } from '#src/shared/business/model/mobile-api-model'
import { type SessionInfo, type SessionSnapshot } from '#src/shared/business/model/session-model'
import { type SettingsModel } from '#src/shared/business/model/settings-model'
import { type UpdateStatus } from '#src/shared/business/model/update-model'
import { type UsageSnapshot } from '#src/shared/business/model/usage-model'

type EventBusMessage<MESSAGE_MAP extends Record<string, unknown>> = {
  [KEY in keyof MESSAGE_MAP]: { payload: MESSAGE_MAP[KEY]; type: KEY }
}[keyof MESSAGE_MAP]

export class _EventBus<MESSAGE_MAP extends Record<string, unknown>> {
  protected readonly _subject = new Subject<EventBusMessage<MESSAGE_MAP>>()

  emit<KEY extends keyof MESSAGE_MAP & string>(params: { payload: MESSAGE_MAP[KEY]; type: KEY }): void {
    const { payload, type } = params
    this._subject.next({ payload, type })
  }

  subscribe<KEY extends keyof MESSAGE_MAP & string>(params: {
    listener: (payload: MESSAGE_MAP[KEY]) => void
    type: KEY
  }): { unsubscribe: () => void } {
    const { listener, type } = params
    const subscription = this._subject.subscribe((message) => {
      if (message.type !== type) {
        return
      }
      try {
        listener(message.payload as MESSAGE_MAP[KEY])
      } catch (error) {
        // eslint-disable-next-line no-console -- repo has no logger util yet
        console.error(error)
      }
    })

    return {
      unsubscribe: () => {
        subscription.unsubscribe()
      },
    }
  }
}

type AppEventMessage = {
  [AppEventType.MOBILE_DEVICES_CHANGED]: MobileConnectedDevice[]
  [AppEventType.SESSIONS_SNAPSHOT]: SessionSnapshot
  [AppEventType.SESSION_FINISHED]: SessionInfo
  [AppEventType.SESSION_WAITING]: SessionInfo
  [AppEventType.SETTINGS_SAVED]: SettingsModel
  [AppEventType.UPDATE_STATUS]: UpdateStatus
  [AppEventType.USAGE_SNAPSHOT]: UsageSnapshot
  [AppEventType.USAGE_WARNING]: UsageWarning
}

export const appEventBusSingleton = singletonPattern((): _EventBus<AppEventMessage> => {
  return new _EventBus<AppEventMessage>()
})
