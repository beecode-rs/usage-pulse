import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { sessionsSshServiceSingleton } from '#src/main/business/service/sessions/ssh-service-singleton'
import { constant } from '#src/main/util/constant'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'
import { type SshHostConfig } from '#src/shared/business/model/settings-model'
import { errorUtil } from '#src/shared/util/error-util'

const execFileAsync = promisify(execFile)

type TmuxCompanionApiInfo = {
  port: number
  token: string
}

export type SessionsFocusTmuxCompanionTarget = {
  host?: string
  port?: number
  sessionName: string
  user?: string
}

export class SessionsFocusTmuxCompanionService {
  async focusSession(params: { host?: SshHostConfig; sessionName: string }): Promise<void> {
    const { host, sessionName } = params
    const focusTarget = this._resolveFocusTarget({ host, sessionName })

    if (await this._tryFocusRunningCompanion({ focusTarget })) {
      return
    }

    await this._openFocusUrl({ focusTarget })
  }

  resolveFocusRequestBody(params: SessionsFocusTmuxCompanionTarget): Record<string, string | number> {
    const body: Record<string, string | number> = { session: params.sessionName }

    if (params.host !== undefined) {
      body['host'] = params.host
    }

    if (params.port !== undefined) {
      body['port'] = params.port
    }

    if (params.user !== undefined) {
      body['user'] = params.user
    }

    return body
  }

  protected _resolveFocusTarget(params: {
    host?: SshHostConfig
    sessionName: string
  }): SessionsFocusTmuxCompanionTarget {
    const { host, sessionName } = params
    if (host === undefined) {
      return { sessionName }
    }

    const target = sessionsSshServiceSingleton().parseHostUrl({ url: host.url })

    if (target === undefined) {
      throw new Error(`'${host.url}' is not a valid ssh host url`)
    }

    return { host: target.destination, port: target.port, sessionName, user: target.user }
  }

  protected async _tryFocusRunningCompanion(params: {
    focusTarget: SessionsFocusTmuxCompanionTarget
  }): Promise<boolean> {
    const { focusTarget } = params
    const apiInfo = await this._resolveRunningCompanionApiInfo()

    if (apiInfo === undefined) {
      return false
    }

    let response: Response

    try {
      response = await fetch(this._resolveCompanionFocusUrl({ port: apiInfo.port }), {
        body: JSON.stringify(this.resolveFocusRequestBody(focusTarget)),
        headers: [
          ['Authorization', `Bearer ${apiInfo.token}`],
          ['Content-Type', 'application/json'],
        ],
        method: 'POST',
        signal: AbortSignal.timeout(constant.sessions.focus.tmux.companionApi.focusTimeoutMs),
      })
    } catch {
      return false
    }

    if (response.ok) {
      return true
    }

    throw new Error(`the running tmux-companion app rejected the focus request with status ${String(response.status)}`)
  }

  protected async _resolveRunningCompanionApiInfo(): Promise<TmuxCompanionApiInfo | undefined> {
    const content = await readFile(
      join(homedir(), constant.sessions.focus.tmux.companionApi.discoveryFileRelativePath),
      'utf8',
    ).catch(() => {
      return undefined
    })

    if (content === undefined) {
      return undefined
    }

    return this._parseCompanionApiInfo({ content })
  }

  protected _parseCompanionApiInfo(params: { content: string }): TmuxCompanionApiInfo | undefined {
    const parsed = this._toParsedRecord({ content: params.content })

    if (parsed === undefined) {
      return undefined
    }

    const { port, token } = parsed

    if (
      typeof port !== 'number' ||
      !Number.isInteger(port) ||
      port < constant.tcpPort.min ||
      port > constant.tcpPort.max
    ) {
      return undefined
    }

    if (typeof token !== 'string' || token === '') {
      return undefined
    }

    return { port, token }
  }

  protected _toParsedRecord(params: { content: string }): Record<string, unknown> | undefined {
    try {
      const parsed: unknown = JSON.parse(params.content)

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return undefined
      }

      return parsed as Record<string, unknown>
    } catch {
      return undefined
    }
  }

  protected _resolveCompanionFocusUrl(params: { port: number }): string {
    const { port } = params
    const { host, path: focusPath } = constant.sessions.focus.tmux.companionApi

    return `http://${host}:${String(port)}${focusPath}`
  }

  protected async _openFocusUrl(params: { focusTarget: SessionsFocusTmuxCompanionTarget }): Promise<void> {
    const { focusTarget } = params
    const searchParams = new URLSearchParams({ session: focusTarget.sessionName })

    if (focusTarget.host !== undefined) {
      searchParams.set('host', focusTarget.host)
    }

    if (focusTarget.port !== undefined) {
      searchParams.set('port', String(focusTarget.port))
    }

    if (focusTarget.user !== undefined) {
      searchParams.set('user', focusTarget.user)
    }

    const url = `${constant.sessions.focus.tmux.companionScheme}://focus?${searchParams.toString()}`

    try {
      await execFileAsync(this._resolveOpenerCommand(), [url], {
        timeout: constant.sessions.focus.tmux.companionOpenTimeoutMs,
      })
    } catch (error) {
      throw new Error(
        `opening the tmux-companion app failed: ${errorUtil.resolveMessage(error)}; make sure the Tmux Companion app is running or installed (a dev instance only receives focus while it is running)`,
      )
    }
  }

  protected _resolveOpenerCommand(): string {
    switch (osUtil.resolvePlatform()) {
      case OS.LINUX: {
        return 'xdg-open'
      }

      case OS.MACOS: {
        return 'open'
      }

      default: {
        throw new Error('focusing a session through the tmux-companion app is only supported on macOS and Linux')
      }
    }
  }
}
