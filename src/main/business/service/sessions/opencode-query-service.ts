import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'

import { config } from '#src/main/util/config'
import { constant } from '#src/main/util/constant'
import { httpUtil } from '#src/main/util/http-util'

const openCodeServiceFileSchema = z.object({
  password: z.string(),
  url: z.string(),
})

const openCodeActiveIdsSchema = z.object({ data: z.record(z.string(), z.unknown()).catch({}) }).catch({ data: {} })

export class SessionsOpenCodeQueryService {
  protected readonly _homeDir: string

  constructor(params: { homeDir: string } = { homeDir: homedir() }) {
    const { homeDir } = params
    this._homeDir = homeDir
  }

  async fetchSessions(): Promise<
    | {
        active: unknown
        forms: unknown[]
        openTabs: unknown
        permissions: unknown[]
        sessions: unknown
      }
    | undefined
  > {
    try {
      return await this._fetchSessions()
    } catch {
      return undefined
    }
  }

  protected async _fetchSessions(): Promise<{
    active: unknown
    forms: unknown[]
    openTabs: unknown
    permissions: unknown[]
    sessions: unknown
  }> {
    const service = await this._readServiceFile()
    const headers = Object.fromEntries([
      ['Authorization', this._resolveAuthorizationHeader({ password: service.password })],
    ])
    const [sessions, active, openTabs] = await Promise.all([
      httpUtil.fetchJson({
        headers,
        timeoutMs: constant.sessions.opencodeQuery.timeoutMs,
        url: `${service.url}${constant.sessions.opencodeQuery.sessionsPath}`,
      }),
      httpUtil.fetchJson({
        headers,
        timeoutMs: constant.sessions.opencodeQuery.timeoutMs,
        url: `${service.url}${constant.sessions.opencodeQuery.activePath}`,
      }),
      this._readTabsFile(),
    ])
    const activeSessionIds = this._resolveActiveSessionIds({ active })
    const [forms, permissions] = await Promise.all([
      this._fetchWaitingEntries({
        headers,
        pathSuffix: constant.sessions.opencodeQuery.formPathSuffix,
        serviceUrl: service.url,
        sessionIds: activeSessionIds,
      }),
      this._fetchWaitingEntries({
        headers,
        pathSuffix: constant.sessions.opencodeQuery.permissionPathSuffix,
        serviceUrl: service.url,
        sessionIds: activeSessionIds,
      }),
    ])

    return { active, forms, openTabs, permissions, sessions }
  }

  protected _resolveActiveSessionIds(params: { active: unknown }): string[] {
    const { active } = params
    const parsedActive = openCodeActiveIdsSchema.parse(active)

    return Object.keys(parsedActive.data)
  }

  protected async _fetchWaitingEntries(params: {
    headers: Record<string, string>
    pathSuffix: string
    serviceUrl: string
    sessionIds: string[]
  }): Promise<unknown[]> {
    const { headers, pathSuffix, serviceUrl, sessionIds } = params
    const envelopes = await Promise.all(
      sessionIds.map((sessionId) => {
        return this._fetchWaitingEnvelope({ headers, pathSuffix, serviceUrl, sessionId })
      }),
    )

    return envelopes.flatMap((envelope) => {
      return envelope ?? []
    })
  }

  protected async _fetchWaitingEnvelope(params: {
    headers: Record<string, string>
    pathSuffix: string
    serviceUrl: string
    sessionId: string
  }): Promise<unknown[] | undefined> {
    const { headers, pathSuffix, serviceUrl, sessionId } = params

    try {
      const parsedEnvelope = await httpUtil.fetchJson({
        headers,
        timeoutMs: constant.sessions.opencodeQuery.timeoutMs,
        url: `${serviceUrl}${constant.sessions.opencodeQuery.sessionPathPrefix}/${sessionId}${pathSuffix}`,
      })

      return this._resolveWaitingEnvelopeEntries({ envelope: parsedEnvelope })
    } catch {
      return undefined
    }
  }

  protected _resolveWaitingEnvelopeEntries(params: { envelope: unknown }): unknown[] {
    const { envelope } = params
    const parsedEnvelope = z
      .object({ data: z.array(z.unknown()).catch([]) })
      .catch({ data: [] })
      .safeParse(envelope)

    if (!parsedEnvelope.success) {
      return []
    }

    return parsedEnvelope.data.data
  }

  protected async _readServiceFile(): Promise<z.infer<typeof openCodeServiceFileSchema>> {
    const filePath = join(this._resolveStateHomeDir(), ...constant.sessions.opencodeQuery.serviceFilePathSegments)
    const content = await readFile(filePath, 'utf8')
    const parsedService = openCodeServiceFileSchema.safeParse(JSON.parse(content))

    if (!parsedService.success) {
      throw new Error('opencode service.json is missing the url or the password')
    }

    return parsedService.data
  }

  protected async _readTabsFile(): Promise<unknown> {
    try {
      const filePath = join(this._resolveStateHomeDir(), ...constant.sessions.opencodeQuery.tabsFilePathSegments)
      const content = await readFile(filePath, 'utf8')

      return JSON.parse(content)
    } catch {
      return undefined
    }
  }

  protected _resolveStateHomeDir(): string {
    if (config.xdg.stateHome !== undefined) {
      return config.xdg.stateHome
    }

    return join(this._homeDir, '.local', 'state')
  }

  protected _resolveAuthorizationHeader(params: { password: string }): string {
    const { password } = params
    const credentials = `${constant.sessions.opencodeQuery.authUser}:${password}`

    return `Basic ${Buffer.from(credentials).toString('base64')}`
  }
}
