import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { SessionsProcessService } from '#src/main/business/service/sessions/process-service'
import { errorUtil } from '#src/main/util/error-util'

const execFileAsync = promisify(execFile)

const FOCUS_TOOL_CHECK_TIMEOUT_MS = 5_000

const FOCUS_TOOL_INSTALL_TIMEOUT_MS = 300_000

const MAX_ANCESTOR_HOPS = 12

const XDOTOOL_TIMEOUT_MS = 5_000

export class SessionsFocusLinuxService {
  protected readonly _processService = new SessionsProcessService()

  async focusSession(params: { isWaylandSession: boolean; pid: number }): Promise<void> {
    const { isWaylandSession, pid } = params
    const windowId = await this._resolveLinuxWindowId({ hopCount: 0, pid })

    if (windowId === undefined) {
      throw new Error(this._resolveWindowNotFoundMessage({ isWaylandSession }))
    }

    await this._activateLinuxWindow({ windowId })
  }

  async isFocusToolInstalled(): Promise<boolean> {
    try {
      await execFileAsync('xdotool', ['version'], { timeout: FOCUS_TOOL_CHECK_TIMEOUT_MS })

      return true
    } catch (error) {
      if (this._isXdotoolMissing({ error })) {
        return false
      }

      return true
    }
  }

  async installFocusTool(): Promise<void> {
    // TODO we should not install anything without check from user, check this. Remove TODO after checking
    await execFileAsync('pkexec', ['apt', 'install', '-y', 'xdotool'], {
      timeout: FOCUS_TOOL_INSTALL_TIMEOUT_MS,
    })
  }

  protected _resolveWindowNotFoundMessage(params: { isWaylandSession: boolean }): string {
    const { isWaylandSession } = params
    if (isWaylandSession) {
      return 'focusing a session terminal on Linux is not supported on Wayland yet; the session has no X11 window'
    }

    return 'could not find an X11 window for the session terminal; it may run through a remote VS Code server or tunnel'
  }

  protected async _resolveLinuxWindowId(params: { hopCount: number; pid: number }): Promise<string | undefined> {
    const { hopCount, pid } = params
    if (hopCount >= MAX_ANCESTOR_HOPS) {
      return undefined
    }

    const windowId = await this._searchLinuxWindowIdByPid({ pid })

    if (windowId !== undefined) {
      return windowId
    }

    if (pid <= 1) {
      return undefined
    }

    const entry = await this._processService.resolveProcessEntry({ pid })

    if (entry === undefined) {
      return undefined
    }

    return this._resolveLinuxWindowId({ hopCount: hopCount + 1, pid: entry.ppid })
  }

  protected async _searchLinuxWindowIdByPid(params: { pid: number }): Promise<string | undefined> {
    const { pid } = params
    const visibleWindowId = await this._runLinuxWindowIdSearch({
      args: ['search', '--onlyvisible', '--pid', String(pid)],
    })

    if (visibleWindowId !== undefined) {
      return visibleWindowId
    }

    return this._runLinuxWindowIdSearch({ args: ['search', '--pid', String(pid)] })
  }

  protected async _runLinuxWindowIdSearch(params: { args: string[] }): Promise<string | undefined> {
    const { args } = params
    try {
      const { stdout } = await execFileAsync('xdotool', args, {
        timeout: XDOTOOL_TIMEOUT_MS,
      })

      return this._parseFirstWindowId({ stdout })
    } catch (error) {
      if (this._isXdotoolMissing({ error })) {
        throw new Error(
          'focusing a session terminal on Linux requires the xdotool tool; install it via the system package manager',
        )
      }

      return undefined
    }
  }

  protected _parseFirstWindowId(params: { stdout: string }): string | undefined {
    const { stdout } = params
    const firstLine = stdout.trim().split('\n')[0]

    if (firstLine === undefined || firstLine === '') {
      return undefined
    }

    return firstLine
  }

  protected async _activateLinuxWindow(params: { windowId: string }): Promise<void> {
    const { windowId } = params
    try {
      await execFileAsync('xdotool', ['windowactivate', windowId], {
        timeout: XDOTOOL_TIMEOUT_MS,
      })
    } catch (error) {
      throw new Error(`activating window ${windowId} failed: ${errorUtil.resolveMessage(error)}`)
    }
  }

  protected _isXdotoolMissing(params: { error: unknown }): boolean {
    const { error } = params

    return (error as { code?: unknown }).code === 'ENOENT'
  }
}
