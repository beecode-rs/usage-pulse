import { app } from 'electron'
import { type IncomingMessage, type ServerResponse } from 'node:http'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { sessionsPollServiceSingleton } from '#src/main/business/service/sessions/poll-service-singleton'
import { usagePollServiceSingleton } from '#src/main/business/service/usage-poll-service-singleton'
import { type MobileStateResponse } from '#src/shared/business/model/mobile-api-model'

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

export const httpRequestHandler = {
  handleRequest: (params: { request: IncomingMessage; response: ServerResponse }): void => {
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

    writeJson({ body: { error: 'not found' }, response, status: 404 })
  },
}
