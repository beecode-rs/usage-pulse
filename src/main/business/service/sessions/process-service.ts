import { execFile } from 'node:child_process'
import { readdir, readlink } from 'node:fs/promises'
import { promisify } from 'node:util'

import { constant } from '#src/main/util/constant'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'

const execFileAsync = promisify(execFile)

type ProcessEntry = {
  comm: string
  ppid: number
}

type AppBundleAncestry = {
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
    if (hopCount >= constant.sessions.processAncestry.maxHops) {
      throw new Error(
        `could not find an application bundle for the session process; the ancestor walk exceeded ${String(constant.sessions.processAncestry.maxHops)} hops`,
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
        timeout: constant.sessions.psQuery.timeoutMs,
      })

      return this._parseProcessLine({ line: stdout.trim() })
    } catch {
      return undefined
    }
  }

  async resolveMostRecentPidByCwd(params: { cwd: string }): Promise<number | undefined> {
    const { cwd } = params
    const pids = await this.resolvePidsByCwd({ cwd })

    if (pids.length === 0) {
      return undefined
    }

    return await this._resolveMostRecentPid({ pids })
  }

  async resolvePidsByCwd(params: { cwd: string }): Promise<number[]> {
    const { cwd } = params
    switch (osUtil.resolvePlatform()) {
      case OS.LINUX: {
        return await this._resolveLinuxPidsByCwd({ cwd })
      }

      case OS.MACOS: {
        return await this._resolveMacOsPidsByCwd({ cwd })
      }

      default: {
        return []
      }
    }
  }

  async resolveProcessStartTime(params: { pid: number }): Promise<number | undefined> {
    const { pid } = params
    try {
      const { stdout } = await execFileAsync('ps', ['-o', 'lstart=', '-p', String(pid)], {
        timeout: constant.sessions.psQuery.timeoutMs,
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
        timeout: constant.sessions.psQuery.timeoutMs,
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

  parseLsofPidLine(params: { line: string }): number | undefined {
    const match = constant.lsofPidLineRegex.exec(params.line)

    if (match === null) {
      return undefined
    }

    const pid = Number(match[1])

    if (!Number.isInteger(pid) || pid <= 0) {
      return undefined
    }

    return pid
  }

  parseLsofPidLines(params: { stdout: string }): number[] {
    const { stdout } = params

    return stdout
      .trim()
      .split('\n')
      .map((line) => {
        return this.parseLsofPidLine({ line })
      })
      .filter((pid): pid is number => {
        return pid !== undefined
      })
  }

  protected async _resolveLinuxPidsByCwd(params: { cwd: string }): Promise<number[]> {
    const procEntries = await readdir(constant.linuxProcDir).catch(() => {
      return [] as string[]
    })
    const pidEntries = procEntries.filter((entry) => {
      return constant.digitsOnlyRegex.test(entry)
    })
    const matchedPids = await Promise.all(
      pidEntries.map(async (pidEntry) => {
        const linkedCwd = await readlink(`${constant.linuxProcDir}/${pidEntry}/cwd`).catch(() => {
          return undefined
        })

        if (linkedCwd === params.cwd) {
          return Number(pidEntry)
        }

        return undefined
      }),
    )

    return matchedPids.filter((pid): pid is number => {
      return pid !== undefined
    })
  }

  protected async _resolveMacOsPidsByCwd(params: { cwd: string }): Promise<number[]> {
    try {
      const { stdout } = await execFileAsync('lsof', ['-a', '-d', 'cwd', '-F', 'p', params.cwd], {
        timeout: constant.sessions.psQuery.timeoutMs,
      })

      return this.parseLsofPidLines({ stdout })
    } catch {
      return []
    }
  }

  protected async _resolveMostRecentPid(params: { pids: number[] }): Promise<number | undefined> {
    const pidStarts = await Promise.all(
      params.pids.map(async (pid) => {
        return { pid, startedAtMs: await this.resolveProcessStartTime({ pid }) }
      }),
    )
    const orderedPidStarts = [...pidStarts].sort((left, right) => {
      return this._resolvePidStartRank(right) - this._resolvePidStartRank(left)
    })

    return orderedPidStarts[0]?.pid
  }

  protected _resolvePidStartRank(params: { startedAtMs?: number }): number {
    if (params.startedAtMs === undefined) {
      return 0
    }

    return params.startedAtMs
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
