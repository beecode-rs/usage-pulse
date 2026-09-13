import { EventBusUtil } from '#src/main/util/event-bus-util'

type MessageMap = {
  ping: string
  pong: string
}

type Message = { payload: string; type: keyof MessageMap }

export const eventBusUtilContractHarness = {
  deliverMessagesInOrder: (params: { messages: Message[] }): string[] => {
    const { messages } = params
    const deliveries: string[] = []
    const bus = new EventBusUtil<MessageMap>()
    const subscription = bus.subscribe({
      listener: (payload) => {
        deliveries.push(payload)
      },
      type: 'ping',
    })
    messages.forEach((message) => {
      bus.emit(message)
    })
    subscription.unsubscribe()

    return deliveries
  },
  deliverNothingToLateSubscriber: (params: { firstMessage: Message; secondMessage: Message }): string[] => {
    const { firstMessage, secondMessage } = params
    const deliveries: string[] = []
    const bus = new EventBusUtil<MessageMap>()
    bus.emit(firstMessage)
    const subscription = bus.subscribe({
      listener: (payload) => {
        deliveries.push(payload)
      },
      type: 'ping',
    })
    bus.emit(secondMessage)
    subscription.unsubscribe()

    return deliveries
  },
  deliverToAllSubscribers: (params: { listenerCount: number; message: Message }): string[][] => {
    const { listenerCount, message } = params
    const bus = new EventBusUtil<MessageMap>()
    const deliveriesByListener: string[][] = []
    const subscriptions = Array.from({ length: listenerCount }, () => {
      const deliveries: string[] = []
      deliveriesByListener.push(deliveries)

      return bus.subscribe({
        listener: (payload) => {
          deliveries.push(payload)
        },
        type: 'ping',
      })
    })
    bus.emit(message)
    subscriptions.forEach((subscription) => {
      subscription.unsubscribe()
    })

    return deliveriesByListener
  },
  isEmitWithoutSubscribersSafe: (params: { message: Message }): boolean => {
    const { message } = params
    const bus = new EventBusUtil<MessageMap>()
    bus.emit(message)

    return true
  },
  keepDeliveringWhenListenerThrows: (params: { message: Message }): string[][] => {
    const { message } = params
    const bus = new EventBusUtil<MessageMap>()
    const throwingSubscription = bus.subscribe({
      listener: () => {
        throw new Error('listener failure')
      },
      type: 'ping',
    })
    const deliveriesByListener: string[][] = []
    const subscriptions = [0, 1].map(() => {
      const deliveries: string[] = []
      deliveriesByListener.push(deliveries)

      return bus.subscribe({
        listener: (payload) => {
          deliveries.push(payload)
        },
        type: 'ping',
      })
    })
    bus.emit(message)
    throwingSubscription.unsubscribe()
    subscriptions.forEach((subscription) => {
      subscription.unsubscribe()
    })

    return deliveriesByListener
  },
  unsubscribeListenerBlocksFurtherDelivery: (params: {
    listenerCount: number
    message: Message
    unsubscribeListenerIndex: number
  }): string[][] => {
    const { listenerCount, message, unsubscribeListenerIndex } = params
    const bus = new EventBusUtil<MessageMap>()
    const deliveriesByListener: string[][] = []
    const subscriptions = Array.from({ length: listenerCount }, () => {
      const deliveries: string[] = []
      deliveriesByListener.push(deliveries)

      return bus.subscribe({
        listener: (payload) => {
          deliveries.push(payload)
        },
        type: 'ping',
      })
    })
    subscriptions[unsubscribeListenerIndex]?.unsubscribe()
    bus.emit(message)
    subscriptions.forEach((subscription) => {
      subscription.unsubscribe()
    })

    return deliveriesByListener
  },
  unsubscribeTwiceKeepsBusUsable: (params: {
    firstMessage: Message
    secondMessage: Message
  }): {
    freshDeliveries: string[]
    staleDeliveries: string[]
  } => {
    const { firstMessage, secondMessage } = params
    const bus = new EventBusUtil<MessageMap>()
    const staleDeliveries: string[] = []
    const freshDeliveries: string[] = []
    const staleSubscription = bus.subscribe({
      listener: (payload) => {
        staleDeliveries.push(payload)
      },
      type: 'ping',
    })
    staleSubscription.unsubscribe()
    staleSubscription.unsubscribe()
    const freshSubscription = bus.subscribe({
      listener: (payload) => {
        freshDeliveries.push(payload)
      },
      type: 'ping',
    })
    bus.emit(firstMessage)
    bus.emit(secondMessage)
    freshSubscription.unsubscribe()

    return { freshDeliveries, staleDeliveries }
  },
}
