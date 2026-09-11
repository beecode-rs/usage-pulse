import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { SessionsParserService } from '#src/main/business/service/sessions-parser-service'
import { errorUtil } from '#src/main/util/error-util'
import { type SessionInfo, type SessionSnapshot, type UnreachableHost } from '#src/shared/business/model/session-model'
import { type SshHostConfig } from '#src/shared/business/model/settings-model'

const execFileAsync = promisify(execFile)

const SSH_CONNECT_TIMEOUT_SECONDS = 5

const SSH_HOST_CACHE_TTL_MS = 15_000

const SSH_QUERY_TIMEOUT_MS = 10_000

const SSH_TEST_TIMEOUT_MS = 8_000

const REMOTE_AGENTS_COMMAND = String.raw`bash -lc 'PATH="$HOME/.local/bin:$PATH" claude agents --json'`

const REMOTE_PROBE_COMMAND = 'true'

type SshTarget = {
  destination: string
  port?: number
  user?: string
}

export type SshHostFetchResult = {
  errorMessage?: string
  host: SshHostConfig
  sessions: SessionInfo[]
}

type SshHostCacheEntry = {
  fetchedAt: number
  fingerprint: string
  result: SshHostFetchResult
}

export class SshSessionsService {
  protected readonly _cacheById = new Map<string, SshHostCacheEntry>()

  protected readonly _inFlightById = new Map<string, Promise<SshHostFetchResult>>()

  async listRemoteSessions(params: { hosts: SshHostConfig[] }): Promise<SshHostFetchResult[]> {
    const enabledHosts = params.hosts.filter((host) => {
      return host.isEnabled
    })

    this._pruneCache({ hosts: enabledHosts })

    return await Promise.all(
      enabledHosts.map((host) => {
        return this._resolveHostResult({ host })
      }),
    )
  }

  mergeSessionSnapshots(params: {
    localSnapshot: SessionSnapshot
    remoteResults: SshHostFetchResult[]
  }): SessionSnapshot {
    const remoteSessions = params.remoteResults.flatMap((remoteResult) => {
      return remoteResult.sessions.map((session) => {
        return { ...session, hostId: remoteResult.host.id, hostLabel: remoteResult.host.url }
      })
    })
    const unreachableHosts: UnreachableHost[] = params.remoteResults
      .filter((remoteResult) => {
        return remoteResult.errorMessage !== undefined
      })
      .map((remoteResult) => {
        return {
          errorMessage: remoteResult.errorMessage ?? '',
          hostId: remoteResult.host.id,
          hostLabel: remoteResult.host.url,
        }
      })

    return {
      fetchedAt: Date.now(),
      sessions: new SessionsParserService().sortSessions([...params.localSnapshot.sessions, ...remoteSessions]),
      unreachableHosts,
    }
  }

  async testHost(params: { url: string }): Promise<void> {
    const target = this._parseHostUrl({ url: params.url })

    if (target === undefined) {
      throw new Error(`'${params.url}' is not a valid ssh host url`)
    }

    try {
      await execFileAsync('ssh', this._buildSshArgs({ command: REMOTE_PROBE_COMMAND, target }), {
        timeout: SSH_TEST_TIMEOUT_MS,
      })
    } catch (error) {
      throw new Error(`connecting to '${params.url}' failed: ${this._resolveSshErrorMessage(error)}`)
    }
  }

  protected async _resolveHostResult(params: { host: SshHostConfig }): Promise<SshHostFetchResult> {
    const fingerprint = this._resolveHostFingerprint({ host: params.host })
    const cachedResult = this._resolveFreshCacheResult({
      cacheEntry: this._cacheById.get(params.host.id),
      fingerprint,
    })

    if (cachedResult !== undefined) {
      return cachedResult
    }

    const inFlight = this._inFlightById.get(params.host.id)

    if (inFlight !== undefined) {
      return inFlight
    }

    return await this._startHostFetch({ fingerprint, host: params.host })
  }

  protected _resolveFreshCacheResult(params: {
    cacheEntry: SshHostCacheEntry | undefined
    fingerprint: string
  }): SshHostFetchResult | undefined {
    if (params.cacheEntry === undefined) {
      return undefined
    }

    if (params.cacheEntry.fingerprint !== params.fingerprint) {
      return undefined
    }

    if (Date.now() - params.cacheEntry.fetchedAt >= SSH_HOST_CACHE_TTL_MS) {
      return undefined
    }

    return params.cacheEntry.result
  }

  protected async _startHostFetch(params: { fingerprint: string; host: SshHostConfig }): Promise<SshHostFetchResult> {
    const trackedPromise = this._fetchHostResult({ host: params.host })
      .then((result) => {
        this._cacheById.set(params.host.id, {
          fetchedAt: Date.now(),
          fingerprint: params.fingerprint,
          result,
        })

        return result
      })
      .finally(() => {
        this._inFlightById.delete(params.host.id)
      })

    this._inFlightById.set(params.host.id, trackedPromise)

    return await trackedPromise
  }

  protected async _fetchHostResult(params: { host: SshHostConfig }): Promise<SshHostFetchResult> {
    const target = this._parseHostUrl({ url: params.host.url })

    if (target === undefined) {
      return {
        errorMessage: `'${params.host.url}' is not a valid ssh host url`,
        host: params.host,
        sessions: [],
      }
    }

    try {
      const { stdout } = await execFileAsync('ssh', this._buildSshArgs({ command: REMOTE_AGENTS_COMMAND, target }), {
        timeout: SSH_QUERY_TIMEOUT_MS,
      })

      return {
        host: params.host,
        sessions: new SessionsParserService().parseSessionEntries({ stdout }),
      }
    } catch (error) {
      return {
        errorMessage: `connecting to '${params.host.url}' failed: ${this._resolveSshErrorMessage(error)}`,
        host: params.host,
        sessions: [],
      }
    }
  }

  protected _buildSshArgs(params: { command: string; target: SshTarget }): string[] {
    const args = [
      '-o',
      'BatchMode=yes',
      '-o',
      `ConnectTimeout=${String(SSH_CONNECT_TIMEOUT_SECONDS)}`,
      '-o',
      'StrictHostKeyChecking=accept-new',
      '-o',
      'LogLevel=ERROR',
    ]

    if (params.target.port !== undefined) {
      args.push('-p', String(params.target.port))
    }

    if (params.target.user !== undefined) {
      args.push('-l', params.target.user)
    }

    args.push(params.target.destination, params.command)

    return args
  }

  protected _parseHostUrl(params: { url: string }): SshTarget | undefined {
    const trimmedUrl = params.url.trim()

    if (trimmedUrl === '') {
      return undefined
    }

    const target = this._stripSshScheme({ url: trimmedUrl })
    const lastAtIndex = target.lastIndexOf('@')

    if (lastAtIndex === 0) {
      return undefined
    }

    const user = this._resolveSliceBefore({ index: lastAtIndex, value: target })
    const hostAndPort = this._resolveSliceAfter({ index: lastAtIndex, value: target })

    return this._parseHostAndPort({ hostAndPort, user })
  }

  protected _parseHostAndPort(params: { hostAndPort: string; user: string | undefined }): SshTarget | undefined {
    if (params.hostAndPort === '' || params.hostAndPort.includes('/') || params.hostAndPort.startsWith('-')) {
      return undefined
    }

    const lastColonIndex = params.hostAndPort.lastIndexOf(':')

    if (lastColonIndex < 0) {
      return { destination: params.hostAndPort, user: params.user }
    }

    const destination = params.hostAndPort.slice(0, lastColonIndex)
    const port = this._resolvePort({ value: params.hostAndPort.slice(lastColonIndex + 1) })

    if (destination === '' || port === undefined) {
      return undefined
    }

    return { destination, port, user: params.user }
  }

  protected _stripSshScheme(params: { url: string }): string {
    if (!params.url.startsWith('ssh://')) {
      return params.url
    }

    return params.url.slice('ssh://'.length)
  }

  protected _resolveSliceBefore(params: { index: number; value: string }): string | undefined {
    if (params.index <= 0) {
      return undefined
    }

    return params.value.slice(0, params.index)
  }

  protected _resolveSliceAfter(params: { index: number; value: string }): string {
    if (params.index < 0) {
      return params.value
    }

    return params.value.slice(params.index + 1)
  }

  protected _resolvePort(params: { value: string }): number | undefined {
    if (!/^\d+$/.test(params.value)) {
      return undefined
    }

    const port = Number(params.value)

    if (port < 1 || port > 65535) {
      return undefined
    }

    return port
  }

  protected _pruneCache(params: { hosts: SshHostConfig[] }): void {
    const hostsById = new Map(
      params.hosts.map((host) => {
        return [host.id, host]
      }),
    )
    const keptEntries = [...this._cacheById.entries()].filter(([hostId, cacheEntry]) => {
      const host = hostsById.get(hostId)

      return host !== undefined && this._resolveHostFingerprint({ host }) === cacheEntry.fingerprint
    })

    this._cacheById.clear()

    keptEntries.reduce((cache, [hostId, cacheEntry]) => {
      cache.set(hostId, cacheEntry)

      return cache
    }, this._cacheById)
  }

  protected _resolveHostFingerprint(params: { host: SshHostConfig }): string {
    return `${params.host.id}:${params.host.url}`
  }

  protected _resolveSshErrorMessage(error: unknown): string {
    const stderr = (error as { stderr?: unknown }).stderr

    if (typeof stderr === 'string' && stderr.trim() !== '') {
      return stderr.trim()
    }

    return errorUtil.resolveMessage(error)
  }
}
