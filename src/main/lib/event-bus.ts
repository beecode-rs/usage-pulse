import { Subject } from 'rxjs'

type EventBusMessage<MESSAGE_MAP extends Record<string, unknown>> = {
  [KEY in keyof MESSAGE_MAP]: { payload: MESSAGE_MAP[KEY]; type: KEY }
}[keyof MESSAGE_MAP]

export class EventBus<MESSAGE_MAP extends Record<string, unknown>> {
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
