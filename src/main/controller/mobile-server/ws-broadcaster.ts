import { randomUUID } from 'node:crypto'
import { type IncomingMessage } from 'node:http'
import { type Duplex } from 'node:stream'
import { WebSocket, WebSocketServer } from 'ws'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { mobileWsMessageSchema } from '#src/main/business/schema/mobile-api-schema'
import { type MobileConnectedDevice, type MobileWsMessage } from '#src/shared/business/model/mobile-api-model'
import { constant } from '#src/shared/util/constant'

export class WsBroadcaster {
  protected _connectedDeviceByWs = new Map<WebSocket, MobileConnectedDevice>()
  protected _heartbeatTimer: ReturnType<typeof setInterval> | undefined
  protected _isAliveByWs = new Map<WebSocket, boolean>()
  protected _wss: WebSocketServer | undefined

  start(params: { onClientConnected: (params: { ws: WebSocket }) => void; onClientsChanged: () => void }): void {
    const { onClientConnected, onClientsChanged } = params
    this.stop()
    const wss = new WebSocketServer({ noServer: true })

    wss.on('connection', (ws, request) => {
      this._connectedDeviceByWs.set(ws, this._createConnectedDevice({ request }))
      this._isAliveByWs.set(ws, true)
      ws.on('pong', () => {
        this._isAliveByWs.set(ws, true)
      })
      ws.on('close', () => {
        this._connectedDeviceByWs.delete(ws)
        this._isAliveByWs.delete(ws)
        onClientsChanged()
      })
      onClientConnected({ ws })
      onClientsChanged()
    })

    this._wss = wss
    this._heartbeatTimer = setInterval(() => {
      this._onHeartbeatTick()
    }, constant.mobileServer.heartbeatIntervalMs)
  }

  getConnectedDevices(): MobileConnectedDevice[] {
    return [...this._connectedDeviceByWs.values()]
  }

  handleUpgrade(params: { head: Buffer; request: IncomingMessage; socket: Duplex }): void {
    const { head, request, socket } = params
    const url = new URL(request.url ?? '/', 'http://localhost')
    const wss = this._wss
    const token = settingsRepoSingleton().fetch().mobileServerToken

    if (wss === undefined || url.pathname !== '/ws' || url.searchParams.get('token') !== token) {
      socket.destroy()

      return
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  }

  broadcast(params: { message: MobileWsMessage }): void {
    const { message } = params
    const serializedMessage = this._serializeMessage({ message })

    if (serializedMessage === undefined) {
      return
    }

    this._wss?.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return
      }

      client.send(serializedMessage)
    })
  }

  send(params: { message: MobileWsMessage; ws: WebSocket }): void {
    const { message, ws } = params
    const serializedMessage = this._serializeMessage({ message })

    if (serializedMessage === undefined || ws.readyState !== WebSocket.OPEN) {
      return
    }

    ws.send(serializedMessage)
  }

  stop(): void {
    if (this._heartbeatTimer !== undefined) {
      clearInterval(this._heartbeatTimer)
      this._heartbeatTimer = undefined
    }

    const wss = this._wss
    this._wss = undefined
    this._connectedDeviceByWs.clear()
    this._isAliveByWs.clear()

    if (wss === undefined) {
      return
    }

    wss.clients.forEach((client) => {
      client.terminate()
    })
    wss.close()
  }

  protected _onHeartbeatTick(): void {
    const wss = this._wss

    if (wss === undefined) {
      return
    }

    wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        return
      }

      if (this._isAliveByWs.get(client) !== true) {
        client.terminate()
        this._isAliveByWs.delete(client)

        return
      }

      this._isAliveByWs.set(client, false)
      client.ping()
    })

    this.broadcast({ message: { at: Date.now(), type: 'heartbeat' } })
  }

  protected _createConnectedDevice(params: { request: IncomingMessage }): MobileConnectedDevice {
    const { request } = params

    return {
      address: request.socket.remoteAddress?.replace('::ffff:', '') ?? 'unknown',
      connectedAt: Date.now(),
      id: randomUUID(),
      userAgent: this._resolveUserAgent({ header: request.headers['user-agent'] }),
    }
  }

  protected _resolveUserAgent(params: { header: string | string[] | undefined }): string {
    const { header } = params

    if (header === undefined) {
      return constant.mobileServer.unknownUserAgent
    }

    if (Array.isArray(header)) {
      return header[0] ?? constant.mobileServer.unknownUserAgent
    }

    return header
  }

  protected _serializeMessage(params: { message: MobileWsMessage }): string | undefined {
    const { message } = params
    const parsedMessage = mobileWsMessageSchema.safeParse(message)

    if (!parsedMessage.success) {
      return undefined
    }

    return JSON.stringify(parsedMessage.data)
  }
}
