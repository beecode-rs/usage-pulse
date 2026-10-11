import { app } from 'electron'
import { type IncomingMessage, type ServerResponse } from 'node:http'
import { z } from 'zod'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { sessionsPollServiceSingleton } from '#src/main/business/service/sessions/poll-service-singleton'
import { usagePollServiceSingleton } from '#src/main/business/service/usage-poll-service-singleton'
import { validationUtil } from '#src/main/util/validation-util'
import { type MobileStateResponse } from '#src/shared/business/model/mobile-api-model'
import { constant } from '#src/shared/util/constant'

const trackerRefreshParamsSchema = z.object({ trackerId: z.string().min(1) })
const trackerSetPausedParamsSchema = z.object({ isAutoRefreshPaused: z.boolean(), trackerId: z.string().min(1) })

const isAuthorized = (params: { request: IncomingMessage; url: URL }): boolean => {
  const { request, url } = params
  const token = settingsRepoSingleton().fetch().mobileServerToken

  if (request.headers.authorization === `Bearer ${token}`) {
    return true
  }

  return url.searchParams.get('token') === token
}

const buildStateResponse = (): MobileStateResponse => {
  return {
    sessions: sessionsPollServiceSingleton().getSnapshot() ?? null,
    usage: usagePollServiceSingleton().getSnapshot(),
  }
}

const writeJson = (params: { body: unknown; response: ServerResponse; status: number }): void => {
  const { body, response, status } = params
  response.setHeader('content-type', 'application/json')
  response.writeHead(status)
  response.end(JSON.stringify(body))
}

const readJsonBody = (params: { request: IncomingMessage }): Promise<unknown> => {
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

const parseBodyBySchema = async <T extends z.ZodType>(params: {
  request: IncomingMessage
  response: ServerResponse
  schema: T
}): Promise<z.infer<T> | undefined> => {
  const { request, response, schema } = params

  try {
    return validationUtil.parse(await readJsonBody({ request }), schema)
  } catch {
    writeJson({ body: { error: 'invalid body' }, response, status: 400 })

    return undefined
  }
}

const handleTrackerRefresh = async (params: { request: IncomingMessage; response: ServerResponse }): Promise<void> => {
  const { request, response } = params
  const command = await parseBodyBySchema({ request, response, schema: trackerRefreshParamsSchema })

  if (command === undefined) {
    return
  }

  await usagePollServiceSingleton().refreshTracker({ trackerId: command.trackerId })
  writeJson({ body: buildStateResponse(), response, status: 200 })
}

const handleTrackerSetPaused = async (params: {
  request: IncomingMessage
  response: ServerResponse
}): Promise<void> => {
  const { request, response } = params
  const command = await parseBodyBySchema({ request, response, schema: trackerSetPausedParamsSchema })

  if (command === undefined) {
    return
  }

  const settings = settingsRepoSingleton().fetch().withTrackerPaused(command)
  await settingsRepoSingleton().save({ settings })
  writeJson({ body: buildStateResponse(), response, status: 200 })
}

const routeRequest = async (params: { request: IncomingMessage; response: ServerResponse }): Promise<void> => {
  const { request, response } = params
  const url = new URL(request.url ?? '/', 'http://localhost')

  if (!isAuthorized({ request, url })) {
    writeJson({ body: { error: 'unauthorized' }, response, status: 401 })

    return
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    writeJson({ body: { appVersion: app.getVersion(), ok: true }, response, status: 200 })

    return
  }

  if (request.method === 'GET' && url.pathname === '/api/state') {
    writeJson({ body: buildStateResponse(), response, status: 200 })

    return
  }

  if (request.method === 'POST' && url.pathname === '/api/tracker/refresh') {
    await handleTrackerRefresh({ request, response })

    return
  }

  if (request.method === 'POST' && url.pathname === '/api/tracker/set-paused') {
    await handleTrackerSetPaused({ request, response })

    return
  }

  writeJson({ body: { error: 'not found' }, response, status: 404 })
}

export const httpRequestHandler = {
  handleRequest: async (params: { request: IncomingMessage; response: ServerResponse }): Promise<void> => {
    const { request, response } = params

    try {
      await routeRequest({ request, response })
    } catch {
      writeJson({ body: { error: 'server error' }, response, status: 500 })
    }
  },
}
