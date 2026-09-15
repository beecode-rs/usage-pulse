import { singletonPattern } from '@beecode/msh-util'

import { type AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { EventBus } from '#src/main/lib/event-bus'
import { type SessionSnapshot } from '#src/shared/business/model/session-model'
import { type SettingsModel } from '#src/shared/business/model/settings-model'
import { type UpdateStatus } from '#src/shared/business/model/update-model'
import { type UsageSnapshot } from '#src/shared/business/model/usage-model'

export type AppEventMessage = {
  [AppEventType.SESSIONS_SNAPSHOT]: SessionSnapshot
  [AppEventType.SETTINGS_SAVED]: SettingsModel
  [AppEventType.UPDATE_STATUS]: UpdateStatus
  [AppEventType.USAGE_SNAPSHOT]: UsageSnapshot
}

export const appEventBusSingleton = singletonPattern((): EventBus<AppEventMessage> => {
  return new EventBus<AppEventMessage>()
})
