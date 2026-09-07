import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { constant } from '#src/main/util/constant'

const execFileAsync = promisify(execFile)

const MAX_ANCESTOR_HOPS = 12

const PS_QUERY_TIMEOUT_MS = 5_000

export type ProcessEntry = {
  comm: string
  ppid: number
}

export type AppBundleAncestry = {
  bundlePath: string
  hostPid: number
}

export class SessionsProcessService {
  async resolveAppBundleAncestry(params: {
    childPid: number
    hopCount: number
    pid: number
  }): Promise<AppBundleAncestry> {
    const { childPid, hopCount, pid } = params
    if (hopCount >= MAX_ANCESTOR_HOPS) {
      throw new Error(
        `could not find an application bundle for the session process; the ancestor walk exceeded ${String(MAX_ANCESTOR_HOPS)} hops`,
      )
    }

    const entry = await this.resolveProcessEntry({ pid })

    if (entry === undefined) {
      throw new Error(`could not find process ${String(pid)}; the session may have ended`)
    }

    const bundlePath = this._resolveAppBundleFromComm({ comm: entry.comm })

    if (bundlePath !== undefined) {
      return { bundlePath, hostPid: childPid }
    }

    if (pid <= 1) {
      throw new Error(
        'could not find an application bundle for the session process; it may not belong to a terminal app',
      )
    }

    return await this.resolveAppBundleAncestry({
      childPid: pid,
      hopCount: hopCount + 1,
      pid: entry.ppid,
    })
  }

  async resolveProcessEntry(params: { pid: number }): Promise<ProcessEntry | undefined> {
    const { pid } = params
    try {
      const { stdout } = await execFileAsync('ps', ['-o', 'ppid=,comm=', '-p', String(pid)], {
        timeout: PS_QUERY_TIMEOUT_MS,
      })

      return this._parseProcessLine({ line: stdout.trim() })
    } catch {
      return undefined
    }
  }

  async resolveProcessStartTime(params: { pid: number }): Promise<number | undefined> {
    const { pid } = params
    try {
      const { stdout } = await execFileAsync('ps', ['-o', 'lstart=', '-p', String(pid)], {
        timeout: PS_QUERY_TIMEOUT_MS,
      })

      return this._parseStartTime({ stdout })
    } catch {
      return undefined
    }
  }

  async resolveProcessTtyPath(params: { pid: number }): Promise<string | undefined> {
    const { pid } = params
    try {
      const { stdout } = await execFileAsync('ps', ['-o', 'tty=', '-p', String(pid)], {
        timeout: PS_QUERY_TIMEOUT_MS,
      })
      const ttyName = stdout.trim()

      if (ttyName === '' || ttyName === '??') {
        return undefined
      }

      return `/dev/${ttyName}`
    } catch {
      return undefined
    }
  }

  protected _parseProcessLine(params: { line: string }): ProcessEntry | undefined {
    const { line } = params
    const match = constant.processLineRegex.exec(line)

    if (match === null) {
      return undefined
    }

    const comm = match[2]

    if (comm === undefined) {
      return undefined
    }

    return { comm, ppid: Number(match[1]) }
  }

  protected _parseStartTime(params: { stdout: string }): number | undefined {
    const { stdout } = params
    const startedAtMs = Date.parse(stdout.trim())

    if (Number.isNaN(startedAtMs)) {
      return undefined
    }

    return startedAtMs
  }

  protected _resolveAppBundleFromComm(params: { comm: string }): string | undefined {
    const { comm } = params
    const match = constant.appBundleRegex.exec(comm)

    if (match === null) {
      return undefined
    }

    return match[1]
  }
}
