import { singletonPattern } from '@beecode/msh-util'
import { type Server, createServer } from 'node:http'
import { type WebSocket } from 'ws'

import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { mobileDerivedEventsServiceSingleton } from '#src/main/business/service/mobile-derived-events-service-singleton'
import { sessionsPollServiceSingleton } from '#src/main/business/service/sessions/poll-service-singleton'
import { usagePollServiceSingleton } from '#src/main/business/service/usage-poll-service-singleton'
import { httpRequestHandler } from '#src/main/controller/mobile-server/http-request-handler'
import { WsBroadcaster } from '#src/main/controller/mobile-server/ws-broadcaster'
import { appEventBusSingleton } from '#src/main/lib/app-event-bus-singleton'
import { errorUtil } from '#src/main/util/error-util'
import { type MobileConnectedDevice } from '#src/shared/business/model/mobile-api-model'

export class _MobileServerService {
  protected _broadcaster: WsBroadcaster | undefined
  protected _isFailed = false
  protected _server: Server | undefined
  protected _subscriptions: { unsubscribe: () => void }[] = []

  async start(): Promise<void> {
    await this.stop()
    this._isFailed = false
    const settings = settingsRepoSingleton().fetch()
    mobileDerivedEventsServiceSingleton().start()
    const broadcaster = this._startBroadcaster()
    this._broadcaster = broadcaster
    this._subscriptions = this._subscribeToBusEvents({ broadcaster })
    await this._listen({ port: settings.mobileServerPort })
  }

  async stop(): Promise<void> {
    this._subscriptions.forEach((subscription) => {
      subscription.unsubscribe()
    })
    this._subscriptions = []
    mobileDerivedEventsServiceSingleton().stop()
    this._broadcaster?.stop()
    this._broadcaster = undefined
    const server = this._server
    this._server = undefined

    if (server === undefined) {
      return
    }

    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve()
      })
    })
  }

  getPort(): number | undefined {
    const address = this._server?.address()

    if (typeof address !== 'object' || address === null) {
      return undefined
    }

    return address.port
  }

  getConnectedDevices(): MobileConnectedDevice[] {
    return this._broadcaster?.getConnectedDevices() ?? []
  }

  isFailed(): boolean {
    return this._isFailed
  }

  protected _startBroadcaster(): WsBroadcaster {
    const broadcaster = new WsBroadcaster()
    broadcaster.start({
      onClientConnected: (params) => {
        this._sendStateMessage({ broadcaster, ws: params.ws })
      },
      onClientsChanged: () => {
        this._emitConnectedDevicesChanged()
      },
    })

    return broadcaster
  }

  protected _emitConnectedDevicesChanged(): void {
    appEventBusSingleton().emit({
      payload: this.getConnectedDevices(),
      type: AppEventType.MOBILE_DEVICES_CHANGED,
    })
  }

  protected _sendStateMessage(params: { broadcaster: WsBroadcaster; ws: WebSocket }): void {
    const { broadcaster, ws } = params
    broadcaster.send({
      message: {
        sessions: sessionsPollServiceSingleton().getSnapshot() ?? null,
        type: 'state',
        usage: usagePollServiceSingleton().getSnapshot(),
      },
      ws,
    })
  }

  protected _subscribeToBusEvents(params: { broadcaster: WsBroadcaster }): { unsubscribe: () => void }[] {
    const { broadcaster } = params

    return [
      appEventBusSingleton().subscribe({
        listener: (session) => {
          broadcaster.broadcast({ message: { session, type: 'session-finished' } })
        },
        type: AppEventType.SESSION_FINISHED,
      }),
      appEventBusSingleton().subscribe({
        listener: (session) => {
          broadcaster.broadcast({ message: { session, type: 'session-waiting' } })
        },
        type: AppEventType.SESSION_WAITING,
      }),
      appEventBusSingleton().subscribe({
        listener: (sessions) => {
          broadcaster.broadcast({ message: { sessions, type: 'sessions-snapshot' } })
        },
        type: AppEventType.SESSIONS_SNAPSHOT,
      }),
      appEventBusSingleton().subscribe({
        listener: (usage) => {
          broadcaster.broadcast({ message: { type: 'usage-snapshot', usage } })
        },
        type: AppEventType.USAGE_SNAPSHOT,
      }),
      appEventBusSingleton().subscribe({
        listener: (warning) => {
          broadcaster.broadcast({ message: { type: 'usage-warning', warning } })
        },
        type: AppEventType.USAGE_WARNING,
      }),
    ]
  }

  protected _listen(params: { port: number }): Promise<void> {
    const { port } = params
    const server = createServer((request, response) => {
      httpRequestHandler.handleRequest({ request, response })
    })

    server.on('upgrade', (request, socket, head) => {
      this._broadcaster?.handleUpgrade({ head, request, socket })
    })
    server.on('error', (error) => {
      this._isFailed = true
      // eslint-disable-next-line no-console -- repo has no logger util yet
      console.error(`mobile server error: ${errorUtil.resolveMessage(error)}`)
    })
    this._server = server

    return new Promise<void>((resolve) => {
      server.once('listening', () => {
        resolve()
      })
      server.once('error', () => {
        resolve()
      })
      server.listen(port)
    })
  }
}

export const mobileServerServiceSingleton = singletonPattern(() => {
  return new _MobileServerService()
})
