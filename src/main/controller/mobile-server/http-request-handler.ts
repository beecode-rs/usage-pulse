import { app } from 'electron'
import { type IncomingMessage, type ServerResponse } from 'node:http'
import { z } from 'zod'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { mobileStateService } from '#src/main/business/service/mobile-state-service'
import { usagePollServiceSingleton } from '#src/main/business/service/usage-poll-service-singleton'
import { validationUtil } from '#src/main/util/validation-util'
import { constant } from '#src/shared/util/constant'

const trackerRefreshParamsSchema = z.object({ trackerId: z.string().min(1) })
const trackerSetPausedParamsSchema = z.object({ isAutoRefreshPaused: z.boolean(), trackerId: z.string().min(1) })

export class HttpRequestHandler {
  async handleRequest(params: { request: IncomingMessage; response: ServerResponse }): Promise<void> {
    const { request, response } = params

    try {
      await this._routeRequest({ request, response })
    } catch {
      this._writeJson({ body: { error: 'server error' }, response, status: 500 })
    }
  }

  protected _isAuthorized(params: { request: IncomingMessage; url: URL }): boolean {
    const { request, url } = params
    const token = settingsRepoSingleton().fetch().mobileServerToken

    if (request.headers.authorization === `Bearer ${token}`) {
      return true
    }

    return url.searchParams.get('token') === token
  }

  protected _writeJson(params: { body: unknown; response: ServerResponse; status: number }): void {
    const { body, response, status } = params
    response.setHeader('content-type', 'application/json')
    response.writeHead(status)
    response.end(JSON.stringify(body))
  }

  protected _readJsonBody(params: { request: IncomingMessage }): Promise<unknown> {
    const { request } = params

    return new Promise<unknown>((resolve, reject) => {
      const chunks: Buffer[] = []
      request.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })
      request.on('end', () => {
        const body = Buffer.concat(chunks)

        if (body.length > constant.mobileServer.maxRequestBodyBytes) {
          reject(new Error('request body too large'))

          return
        }

        try {
          resolve(JSON.parse(body.toString('utf8')) as unknown)
        } catch {
          reject(new Error('invalid json body'))
        }
      })
      request.on('error', (error) => {
        reject(error)
      })
    })
  }

  protected async _parseBodyBySchema<T extends z.ZodType>(params: {
    request: IncomingMessage
    response: ServerResponse
    schema: T
  }): Promise<z.infer<T> | undefined> {
    const { request, response, schema } = params

    try {
      return validationUtil.parse(await this._readJsonBody({ request }), schema)
    } catch {
      this._writeJson({ body: { error: 'invalid body' }, response, status: 400 })

      return undefined
    }
  }

  protected async _handleTrackerRefresh(params: { request: IncomingMessage; response: ServerResponse }): Promise<void> {
    const { request, response } = params
    const command = await this._parseBodyBySchema({ request, response, schema: trackerRefreshParamsSchema })

    if (command === undefined) {
      return
    }

    await usagePollServiceSingleton().refreshTracker({ trackerId: command.trackerId })
    this._writeJson({ body: mobileStateService.getSnapshot(), response, status: 200 })
  }

  protected async _handleTrackerSetPaused(params: {
    request: IncomingMessage
    response: ServerResponse
  }): Promise<void> {
    const { request, response } = params
    const command = await this._parseBodyBySchema({ request, response, schema: trackerSetPausedParamsSchema })

    if (command === undefined) {
      return
    }

    await usagePollServiceSingleton().setTrackerPaused(command)
    this._writeJson({ body: mobileStateService.getSnapshot(), response, status: 200 })
  }

  protected async _routeRequest(params: { request: IncomingMessage; response: ServerResponse }): Promise<void> {
    const { request, response } = params
    const url = new URL(request.url ?? '/', 'http://localhost')

    if (!this._isAuthorized({ request, url })) {
      this._writeJson({ body: { error: 'unauthorized' }, response, status: 401 })

      return
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      this._writeJson({ body: { appVersion: app.getVersion(), ok: true }, response, status: 200 })

      return
    }

    if (request.method === 'GET' && url.pathname === '/api/state') {
      this._writeJson({ body: mobileStateService.getSnapshot(), response, status: 200 })

      return
    }

    if (request.method === 'POST' && url.pathname === '/api/tracker/refresh') {
      await this._handleTrackerRefresh({ request, response })

      return
    }

    if (request.method === 'POST' && url.pathname === '/api/tracker/set-paused') {
      await this._handleTrackerSetPaused({ request, response })

      return
    }

    this._writeJson({ body: { error: 'not found' }, response, status: 404 })
  }
}
