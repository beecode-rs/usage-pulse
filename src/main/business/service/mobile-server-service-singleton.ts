import { singletonPattern } from '@beecode/msh-util'
import { type Server, createServer } from 'node:http'
import { type WebSocket } from 'ws'

import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { appEventBusSingleton } from '#src/main/business/service/app-event-bus-singleton'
import { mobileDerivedEventsServiceSingleton } from '#src/main/business/service/mobile-derived-events-service-singleton'
import { mobileStateService } from '#src/main/business/service/mobile-state-service'
import { HttpRequestHandler } from '#src/main/controller/mobile-server/http-request-handler'
import { WsBroadcaster } from '#src/main/controller/mobile-server/ws-broadcaster'
import { type MobileConnectedDevice } from '#src/shared/business/model/mobile-api-model'
import { type SettingsModel } from '#src/shared/business/model/settings-model'
import { errorUtil } from '#src/shared/util/error-util'

export class _MobileServerService {
  protected _appliedPort: number | undefined
  protected _broadcaster: WsBroadcaster | undefined
  protected _isFailed = false
  protected _isServerActive = false
  protected _server: Server | undefined
  protected _settingsSavedSubscription: { unsubscribe: () => void } | undefined
  protected _subscriptions: { unsubscribe: () => void }[] = []
  protected readonly _httpRequestHandler = new HttpRequestHandler()

  async start(): Promise<void> {
    await this.stop()
    this._settingsSavedSubscription = appEventBusSingleton().subscribe({
      listener: (settings) => {
        void this._syncServerState({ settings }).catch(() => {
          return undefined
        })
      },
      type: AppEventType.SETTINGS_SAVED,
    })
    const settings = settingsRepoSingleton().fetch()

    if (!settings.isMobileServerEnabled) {
      return
    }

    await this._startServer({ port: settings.mobileServerPort })
  }

  async stop(): Promise<void> {
    this._settingsSavedSubscription?.unsubscribe()
    this._settingsSavedSubscription = undefined
    await this._stopServer()
  }

  protected async _startServer(params: { port: number }): Promise<void> {
    const { port } = params
    await this._stopServer()
    this._isFailed = false
    mobileDerivedEventsServiceSingleton().start()
    const broadcaster = this._startBroadcaster()
    this._broadcaster = broadcaster
    this._subscriptions = this._subscribeToBusEvents({ broadcaster })
    await this._listen({ port })
    this._appliedPort = port
    this._isServerActive = true
  }

  protected async _stopServer(): Promise<void> {
    this._subscriptions.forEach((subscription) => {
      subscription.unsubscribe()
    })
    this._subscriptions = []
    mobileDerivedEventsServiceSingleton().stop()
    this._broadcaster?.stop()
    this._broadcaster = undefined
    const server = this._server
    this._server = undefined

    if (server !== undefined) {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve()
        })
      })
    }

    this._appliedPort = undefined
    this._isServerActive = false
  }

  protected _isRestartRequired(params: { port: number }): boolean {
    const { port } = params

    if (!this._isServerActive) {
      return true
    }

    if (this.isFailed()) {
      return true
    }

    return port !== this._appliedPort
  }

  protected async _syncServerState(params: { settings: SettingsModel }): Promise<void> {
    const { settings } = params

    if (!settings.isMobileServerEnabled) {
      await this._stopServer()

      return
    }

    const isRestartRequired = this._isRestartRequired({ port: settings.mobileServerPort })

    if (!isRestartRequired) {
      return
    }

    await this._startServer({ port: settings.mobileServerPort })
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
      message: { ...mobileStateService.getSnapshot(), type: 'state' },
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
      void this._httpRequestHandler.handleRequest({ request, response })
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
