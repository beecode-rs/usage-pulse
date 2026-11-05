import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { sessionsSshServiceSingleton } from '#src/main/business/service/sessions/ssh-service-singleton'
import { processEnvWithUserBinDirPaths } from '#src/main/util/config'
import { constant } from '#src/main/util/constant'
import { type SshHostConfig } from '#src/shared/business/model/settings-model'

const execFileAsync = promisify(execFile)

export type SessionsFocusTmuxPaneRow = {
  paneCurrentPath: string
  panePid: number
  paneTitle: string
  sessionActivityAtSec: number
  sessionName: string
}

type TmuxProcessRow = {
  pid: number
  ppid: number
}

type TmuxProcessTtyRow = {
  pid: number
  tty: string
}

export class SessionsFocusTmuxLocateService {
  async listLocalSessionClientTtys(params: { sessionName: string }): Promise<string[]> {
    const { sessionName } = params
    const stdout = await this._runLocalTmux({
      args: ['list-clients', '-t', `=${sessionName}`, '-F', constant.sessions.focus.tmux.clientTtyListFormat],
    })

    return this.parseTtyList({ stdout })
  }

  parsePaneRows(params: { stdout: string }): SessionsFocusTmuxPaneRow[] {
    const { stdout } = params

    return this._toLines({ value: stdout })
      .map((line) => {
        return this.parsePaneRow({ line })
      })
      .filter((paneRow): paneRow is SessionsFocusTmuxPaneRow => {
        return paneRow !== undefined
      })
  }

  parsePaneRow(params: { line: string }): SessionsFocusTmuxPaneRow | undefined {
    const [sessionName, panePid, paneCurrentPath, sessionActivityAtSec, paneTitle] = params.line.split('\t')

    if (sessionName === undefined || sessionName === '') {
      return undefined
    }

    const parsedPanePid = Number(panePid)
    const parsedActivitySec = Number(sessionActivityAtSec)

    if (!Number.isInteger(parsedPanePid) || parsedPanePid <= 0) {
      return undefined
    }

    return {
      paneCurrentPath: paneCurrentPath ?? '',
      panePid: parsedPanePid,
      paneTitle: paneTitle ?? '',
      sessionActivityAtSec: this._toSessionActivityAtSec({ sessionActivityAtSec: parsedActivitySec }),
      sessionName,
    }
  }

  parseProcessRows(params: { stdout: string }): TmuxProcessRow[] {
    const { stdout } = params

    return this._toLines({ value: stdout })
      .map((line) => {
        return this.parseProcessRow({ line })
      })
      .filter((processRow): processRow is TmuxProcessRow => {
        return processRow !== undefined
      })
  }

  parseProcessRow(params: { line: string }): TmuxProcessRow | undefined {
    const match = constant.tmuxProcessLineRegex.exec(params.line)

    if (match === null) {
      return undefined
    }

    const pid = Number(match[1])
    const ppid = Number(match[2])

    if (!Number.isInteger(pid) || !Number.isInteger(ppid)) {
      return undefined
    }

    return { pid, ppid }
  }

  parseTtyList(params: { stdout: string }): string[] {
    const { stdout } = params

    return this._toLines({ value: stdout }).filter((tty) => {
      return tty !== ''
    })
  }

  async resolveLocalSessionName(params: { cwd: string; name?: string; pid?: number }): Promise<string | undefined> {
    const { cwd, name, pid } = params
    const paneRows = await this._resolveLocalPaneRows()

    return await this._resolveMatchedSessionName({ cwd, name, paneRows, pid })
  }

  async resolveLocalTtyPid(params: { ttyPath: string }): Promise<number | undefined> {
    const { ttyPath } = params
    const { stdout } = await execFileAsync('ps', ['ax', '-o', 'pid=,tty='], {
      timeout: constant.sessions.psQuery.timeoutMs,
    })
    const matchedRow = this.parseProcessTtyRows({ stdout }).find((processTtyRow) => {
      return `/dev/${processTtyRow.tty}` === ttyPath
    })

    return matchedRow?.pid
  }

  async resolveRemoteSessionName(params: {
    cwd: string
    host: SshHostConfig
    name?: string
    pid?: number
  }): Promise<string | undefined> {
    const { cwd, host, name, pid } = params
    const paneRows = await this._resolveRemotePaneRows({ host })

    return await this._resolveMatchedSessionName({ cwd, host, name, paneRows, pid })
  }

  resolveSessionNameByCwd(params: { cwd: string; paneRows: SessionsFocusTmuxPaneRow[] }): string | undefined {
    const { cwd, paneRows } = params
    if (cwd === '') {
      return undefined
    }

    const matchedRows = paneRows.filter((paneRow) => {
      return paneRow.paneCurrentPath === cwd
    })

    if (matchedRows.length === 0) {
      return undefined
    }

    const mostActiveRow = matchedRows.reduce((bestRow, paneRow) => {
      return this._toMostActivePaneRow({ bestRow, candidateRow: paneRow })
    })

    return mostActiveRow.sessionName
  }

  resolveSessionNameByTitle(params: {
    cwd: string
    name: string
    paneRows: SessionsFocusTmuxPaneRow[]
  }): string | undefined {
    const { cwd, name, paneRows } = params

    if (name === '') {
      return undefined
    }

    const matchedRows = paneRows.filter((paneRow) => {
      return paneRow.paneCurrentPath === cwd && paneRow.paneTitle.includes(name)
    })

    if (matchedRows.length === 0) {
      return undefined
    }

    const mostActiveRow = matchedRows.reduce((bestRow, paneRow) => {
      return this._toMostActivePaneRow({ bestRow, candidateRow: paneRow })
    })

    return mostActiveRow.sessionName
  }

  resolveSessionNameByPid(params: {
    ancestorPids: Set<number>
    paneRows: SessionsFocusTmuxPaneRow[]
  }): string | undefined {
    const { ancestorPids, paneRows } = params
    const matchedRow = paneRows.find((paneRow) => {
      return ancestorPids.has(paneRow.panePid)
    })

    return matchedRow?.sessionName
  }

  resolveAncestorPids(params: { parentByPid: Map<number, number>; pid: number }): Set<number> {
    const { parentByPid, pid } = params

    return this._collectAncestorPids({ ancestorPids: new Set<number>(), hopCount: 0, parentByPid, pid })
  }

  parseProcessTtyRows(params: { stdout: string }): TmuxProcessTtyRow[] {
    const { stdout } = params

    return this._toLines({ value: stdout })
      .map((line) => {
        return this.parseProcessTtyRow({ line })
      })
      .filter((processTtyRow): processTtyRow is TmuxProcessTtyRow => {
        return processTtyRow !== undefined
      })
  }

  parseProcessTtyRow(params: { line: string }): TmuxProcessTtyRow | undefined {
    const match = constant.tmuxProcessTtyLineRegex.exec(params.line)

    if (match === null) {
      return undefined
    }

    const pid = Number(match[1])
    const tty = match[2]

    if (!Number.isInteger(pid) || tty === undefined) {
      return undefined
    }

    return { pid, tty }
  }

  protected _toMostActivePaneRow(params: {
    bestRow: SessionsFocusTmuxPaneRow
    candidateRow: SessionsFocusTmuxPaneRow
  }): SessionsFocusTmuxPaneRow {
    const { bestRow, candidateRow } = params
    if (candidateRow.sessionActivityAtSec > bestRow.sessionActivityAtSec) {
      return candidateRow
    }

    return bestRow
  }

  protected _toSessionActivityAtSec(params: { sessionActivityAtSec: number }): number {
    if (Number.isFinite(params.sessionActivityAtSec)) {
      return params.sessionActivityAtSec
    }

    return 0
  }

  protected _collectAncestorPids(params: {
    ancestorPids: Set<number>
    hopCount: number
    parentByPid: Map<number, number>
    pid: number
  }): Set<number> {
    const { ancestorPids, hopCount, parentByPid, pid } = params
    if (hopCount >= constant.sessions.processAncestry.maxHops || pid <= 1) {
      return ancestorPids
    }

    const nextAncestorPids = new Set([...ancestorPids, pid])
    const ppid = parentByPid.get(pid)

    if (ppid === undefined) {
      return nextAncestorPids
    }

    return this._collectAncestorPids({
      ancestorPids: nextAncestorPids,
      hopCount: hopCount + 1,
      parentByPid,
      pid: ppid,
    })
  }

  protected async _resolveAncestorPids(params: { host?: SshHostConfig; pid: number }): Promise<Set<number>> {
    const { host, pid } = params
    const processListCommand = 'ps ax -o pid=,ppid='
    const stdout = await this._resolveProcessListStdout({ host, processListCommand })
    const processRows = this.parseProcessRows({ stdout })
    const parentByPid = new Map(
      processRows.map((processRow) => {
        return [processRow.pid, processRow.ppid]
      }),
    )

    return this.resolveAncestorPids({ parentByPid, pid })
  }

  protected async _resolveLocalPaneRows(): Promise<SessionsFocusTmuxPaneRow[]> {
    const stdout = await this._runLocalTmux({
      args: ['list-panes', '-a', '-F', constant.sessions.focus.tmux.listPanesFormat],
    })

    return this.parsePaneRows({ stdout })
  }

  protected async _resolveMatchedSessionName(params: {
    cwd: string
    host?: SshHostConfig
    name?: string
    paneRows: SessionsFocusTmuxPaneRow[]
    pid?: number
  }): Promise<string | undefined> {
    const { cwd, host, name, paneRows, pid } = params
    if (pid !== undefined && paneRows.length > 0) {
      const ancestorPids = await this._resolveAncestorPids({ host, pid })
      const sessionNameByPid = this.resolveSessionNameByPid({ ancestorPids, paneRows })

      if (sessionNameByPid !== undefined) {
        return sessionNameByPid
      }
    }

    if (name !== undefined && name !== '') {
      const sessionNameByTitle = this.resolveSessionNameByTitle({ cwd, name, paneRows })

      if (sessionNameByTitle !== undefined) {
        return sessionNameByTitle
      }
    }

    return this.resolveSessionNameByCwd({ cwd, paneRows })
  }

  protected async _resolveProcessListStdout(params: {
    host?: SshHostConfig
    processListCommand: string
  }): Promise<string> {
    const { host, processListCommand } = params
    if (host === undefined) {
      try {
        const { stdout } = await execFileAsync('ps', ['ax', '-o', 'pid=,ppid='], {
          timeout: constant.sessions.psQuery.timeoutMs,
        })

        return stdout
      } catch {
        return ''
      }
    }

    return await this._runRemoteCommand({ command: processListCommand, host })
  }

  protected async _resolveRemotePaneRows(params: { host: SshHostConfig }): Promise<SessionsFocusTmuxPaneRow[]> {
    const { host } = params
    const stdout = await this._runRemoteCommand({
      command: `tmux list-panes -a -F '${constant.sessions.focus.tmux.listPanesFormat}'`,
      host,
    })

    return this.parsePaneRows({ stdout })
  }

  protected async _runLocalTmux(params: { args: string[] }): Promise<string> {
    try {
      const { stdout } = await execFileAsync('tmux', params.args, {
        env: processEnvWithUserBinDirPaths(),
        timeout: constant.sessions.focus.tmux.queryTimeoutMs,
      })

      return stdout
    } catch {
      return ''
    }
  }

  protected async _runRemoteCommand(params: { command: string; host: SshHostConfig }): Promise<string> {
    const { command, host } = params
    const target = sessionsSshServiceSingleton().parseHostUrl({ url: host.url })

    if (target === undefined) {
      return ''
    }

    try {
      return await sessionsSshServiceSingleton().execCommand({
        command,
        target,
        timeoutMs: constant.sessions.focus.tmux.queryTimeoutMs,
      })
    } catch {
      return ''
    }
  }

  protected _toLines(params: { value: string }): string[] {
    const { value } = params

    return value
      .trim()
      .split('\n')
      .map((line) => {
        return line.trim()
      })
      .filter((line) => {
        return line !== ''
      })
  }
}
