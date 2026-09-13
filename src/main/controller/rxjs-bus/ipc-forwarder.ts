import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { appEventBusSingleton } from '#src/main/business/service/app-event-bus-singleton'
import { appWindowStoreSingleton } from '#src/main/lib/app-window-store-singleton'
import { IpcChannelMapper } from '#src/shared/business/enum/ipc-channel-mapper-enum'

export const rxjsBusIpcForwarder = {
  register: (): { unsubscribe: () => void }[] => {
    return [
      appEventBusSingleton().subscribe({
        listener: (snapshot) => {
          appWindowStoreSingleton().sendToRenderer({ channel: IpcChannelMapper.SESSIONS_UPDATE, payload: snapshot })
        },
        type: AppEventType.SESSIONS_SNAPSHOT,
      }),
      appEventBusSingleton().subscribe({
        listener: (settings) => {
          appWindowStoreSingleton().sendToRenderer({ channel: IpcChannelMapper.SETTINGS_UPDATE, payload: settings })
        },
        type: AppEventType.SETTINGS_SAVED,
      }),
      appEventBusSingleton().subscribe({
        listener: (status) => {
          appWindowStoreSingleton().sendToRenderer({ channel: IpcChannelMapper.UPDATE_STATUS, payload: status })
        },
        type: AppEventType.UPDATE_STATUS,
      }),
      appEventBusSingleton().subscribe({
        listener: (snapshot) => {
          appWindowStoreSingleton().sendToRenderer({ channel: IpcChannelMapper.USAGE_UPDATE, payload: snapshot })
        },
        type: AppEventType.USAGE_SNAPSHOT,
      }),
    ]
  },
}
