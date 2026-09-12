import { singletonPattern, typeUtil } from '@beecode/msh-util'
import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { basename } from 'node:path'
import { promisify } from 'node:util'

import { GhosttyFocusOutcomeMapper } from '#src/main/business/enum/ghostty-focus-outcome-mapper-enum'
import { SessionsParserService } from '#src/main/business/service/sessions-parser-service'
import { config } from '#src/main/util/config'
import { constant } from '#src/main/util/constant'
import { errorUtil } from '#src/main/util/error-util'
import { osUtil } from '#src/main/util/os-util'
import { rawEnvUtil } from '#src/main/util/raw-env-util'
import { OS } from '#src/shared/business/enum/os-enum'
import { type SessionInfo, type SessionSnapshot } from '#src/shared/business/model/session-model'

const execFileAsync = promisify(execFile)

const FOCUS_TOOL_CHECK_TIMEOUT_MS = 5_000

const FOCUS_TOOL_INSTALL_TIMEOUT_MS = 300_000

const SESSIONS_QUERY_TIMEOUT_MS = 10_000

const GHOSTTY_AUTOMATION_DENIED_MESSAGE =
  'to focus the exact Ghostty tab, allow this app to control Ghostty in System Settings > Privacy & Security > Automation'

const GHOSTTY_BUNDLE_ID = 'com.mitchellh.ghostty'

const GHOSTTY_FRONT_WINDOW_POLL_COUNT = 20

const GHOSTTY_FRONT_WINDOW_POLL_DELAY_SECONDS = 0.1

const GHOSTTY_OTHER_DESKTOP_MESSAGE =
  'the terminal is on another desktop or minimized; to let focus jump to it, enable "When switching to an application, switch to a Space with open windows for the application" in System Settings > Desktop & Dock'

const GHOSTTY_FRONT_WINDOW_WAIT_SNIPPET = `    activate
    repeat ${String(GHOSTTY_FRONT_WINDOW_POLL_COUNT)} times
      delay ${String(GHOSTTY_FRONT_WINDOW_POLL_DELAY_SECONDS)}
      if ((id of front window) as text) is targetWindowId then
        return "focused"
      end if
    end repeat
    return "hidden"`

const GHOSTTY_TAB_FOCUS_SCRIPT = `on run argv
  set sessionCwd to item 1 of argv
  set matchRank to item 2 of argv as integer
  set matchIndex to 0
  set targetWindowId to ""
  tell application id "${GHOSTTY_BUNDLE_ID}"
    repeat with ghosttyWindow in windows
      repeat with ghosttyTab in tabs of ghosttyWindow
        repeat with ghosttyTerminal in terminals of ghosttyTab
          set terminalCwd to working directory of ghosttyTerminal
          if terminalCwd is sessionCwd or terminalCwd is sessionCwd & "/" then
            if matchIndex is matchRank then
              set targetWindowId to (id of ghosttyWindow) as text
              select tab ghosttyTab
              focus ghosttyTerminal
              exit repeat
            end if
            set matchIndex to matchIndex + 1
          end if
        end repeat
        if targetWindowId is not "" then
          exit repeat
        end if
      end repeat
      if targetWindowId is not "" then
        exit repeat
      end if
    end repeat
    if targetWindowId is "" then
      return "missing"
    end if
${GHOSTTY_FRONT_WINDOW_WAIT_SNIPPET}
  end tell
end run`

const GHOSTTY_TTY_FOCUS_SCRIPT = `on run argv
  set sessionTty to item 1 of argv
  set targetWindowId to ""
  tell application id "${GHOSTTY_BUNDLE_ID}"
    repeat with ghosttyWindow in windows
      repeat with ghosttyTab in tabs of ghosttyWindow
        repeat with ghosttyTerminal in terminals of ghosttyTab
          if (tty of ghosttyTerminal) is sessionTty then
            set targetWindowId to (id of ghosttyWindow) as text
            select tab ghosttyTab
            focus ghosttyTerminal
            exit repeat
          end if
        end repeat
        if targetWindowId is not "" then
          exit repeat
        end if
      end repeat
      if targetWindowId is not "" then
        exit repeat
      end if
    end repeat
    if targetWindowId is "" then
      return "missing"
    end if
${GHOSTTY_FRONT_WINDOW_WAIT_SNIPPET}
  end tell
end run`

const GHOSTTY_TTY_SUPPORT_PROBE_SCRIPT = `tell application id "${GHOSTTY_BUNDLE_ID}"
  count of (tty of every terminal)
end tell`

const VSCODE_ACCESSIBILITY_DENIED_MESSAGE =
  'to focus the exact VS Code window, allow this app to control your computer in System Settings > Privacy & Security > Accessibility'

const VSCODE_BUNDLE_BASENAME = 'Visual Studio Code.app'

const VSCODE_SYSTEM_EVENTS_DENIED_MESSAGE =
  'to focus the exact VS Code window, allow this app to control System Events in System Settings > Privacy & Security > Automation'

const VSCODE_TITLE_SEPARATOR = ' — '

const VSCODE_WINDOW_RAISE_SCRIPT = `on run argv
  set appBundlePath to item 1 of argv
  set windowIndex to item 2 of argv as integer
  set appId to id of application appBundlePath
  tell application "System Events"
    tell (first application process whose bundle identifier is appId)
      set frontmost to true
      perform action "AXRaise" of window windowIndex
    end tell
  end tell
end run`

const VSCODE_WINDOW_TITLES_SCRIPT = `on run argv
  set appBundlePath to item 1 of argv
  set appId to id of application appBundlePath
  tell application "System Events"
    tell (first application process whose bundle identifier is appId)
      set originalDelimiters to AppleScript's text item delimiters
      set AppleScript's text item delimiters to linefeed
      set windowNames to (name of every window) as text
      set AppleScript's text item delimiters to originalDelimiters
      return windowNames
    end tell
  end tell
end run`

const MAX_VSCODE_WORKSPACE_NAME_CANDIDATES = 3

const MAX_ANCESTOR_HOPS = 12

const OPEN_APP_TIMEOUT_MS = 5_000

const OSASCRIPT_TIMEOUT_MS = 5_000

const PS_QUERY_TIMEOUT_MS = 5_000

const XDOTOOL_TIMEOUT_MS = 5_000

type ProcessEntry = {
  comm: string
  ppid: number
}

export type AppBundleAncestry = {
  bundlePath: string
  hostPid: number
}

export type GhosttyFocusPeer = {
  hostPid: number
  hostStartedAtMs: number | undefined
  pid: number
}

export class _SessionsService {
  protected _isFocusSupported: Promise<boolean> | undefined
  protected _ghosttyTtySupport: Promise<boolean> | undefined
  protected _inFlightSnapshot: Promise<SessionSnapshot> | undefined
  protected readonly _isWaylandSessionOverride: boolean | undefined

  constructor(params: { isWaylandSession?: boolean } = {}) {
    const { isWaylandSession } = params
    this._isWaylandSessionOverride = isWaylandSession
  }

  async listSessions(): Promise<SessionSnapshot> {
    if (this._inFlightSnapshot !== undefined) {
      return this._inFlightSnapshot
    }

    return this._startSnapshotFetch()
  }

  async focusSession(params: { cwd: string; pid: number }): Promise<void> {
    const { cwd, pid } = params
    await this._focusSessionForPlatform({
      cwd,
      pid,
      platform: this._resolveFocusPlatform(),
    })
  }

  isFocusSupported(): Promise<boolean> {
    this._isFocusSupported ??= this._resolveIsFocusSupported()

    return this._isFocusSupported
  }

  async installFocusTool(): Promise<void> {
    const platform = this._resolveFocusPlatform()

    if (platform !== OS.LINUX) {
      return
    }

    try {
      await this._installLinuxFocusTool()
    } catch (error) {
      throw new Error(`installing xdotool failed: ${errorUtil.resolveMessage(error)}`)
    }

    this._isFocusSupported = undefined
  }

  protected _resolveFocusPlatform(): OS {
    return osUtil.resolvePlatform()
  }

  protected async _focusSessionForPlatform(params: { cwd: string; pid: number; platform: OS }): Promise<void> {
    const { cwd, pid, platform } = params
    switch (platform) {
      case OS.LINUX: {
        return this._focusLinuxSession({ pid })
      }

      case OS.MACOS: {
        return this._focusMacOsSession({ cwd, pid })
      }

      case OS.WINDOWS: {
        throw new Error('focusing a session terminal is only supported on macOS and Linux')
      }

      default: {
        throw typeUtil.exhaustiveError('unsupported platform [platform]', platform)
      }
    }
  }

  protected async _focusMacOsSession(params: { cwd: string; pid: number }): Promise<void> {
    const { cwd, pid } = params
    const bundlePath = await this._resolveAppBundlePath({ hopCount: 0, pid })

    if (cwd !== '' && this._isGhosttyBundle({ bundlePath })) {
      return this._focusGhosttySession({ bundlePath, cwd, pid })
    }

    await this._activateAppBundle({ bundlePath })

    if (cwd === '') {
      return
    }

    if (this._isVsCodeBundle({ bundlePath })) {
      await this._focusVsCodeWindow({ bundlePath, cwd })
    }
  }

  protected async _focusGhosttySession(params: { bundlePath: string; cwd: string; pid: number }): Promise<void> {
    const { bundlePath, cwd, pid } = params
    const outcome = await this._resolveGhosttyFocusOutcome({ cwd, pid })

    return this._applyGhosttyFocusOutcome({ bundlePath, outcome })
  }

  protected async _applyGhosttyFocusOutcome(params: {
    bundlePath: string
    outcome: GhosttyFocusOutcomeMapper
  }): Promise<void> {
    const { bundlePath, outcome } = params
    switch (outcome) {
      case GhosttyFocusOutcomeMapper.FOCUSED: {
        return
      }

      case GhosttyFocusOutcomeMapper.HIDDEN: {
        throw new Error(GHOSTTY_OTHER_DESKTOP_MESSAGE)
      }

      case GhosttyFocusOutcomeMapper.MISSING: {
        return this._activateAppBundle({ bundlePath })
      }

      default: {
        throw typeUtil.exhaustiveError('unsupported ghostty focus outcome [outcome]', outcome)
      }
    }
  }

  protected async _resolveGhosttyFocusOutcome(params: {
    cwd: string
    pid: number
  }): Promise<GhosttyFocusOutcomeMapper> {
    const { cwd, pid } = params
    const ttyOutcome = await this._resolveGhosttyTtyFocusOutcome({ pid })

    if (ttyOutcome !== GhosttyFocusOutcomeMapper.MISSING) {
      return ttyOutcome
    }

    const matchRank = await this._resolveGhosttyMatchRank({ cwd, pid })

    return this._focusGhosttyTab({ cwd, matchRank })
  }

  protected async _resolveGhosttyTtyFocusOutcome(params: { pid: number }): Promise<GhosttyFocusOutcomeMapper> {
    const { pid } = params
    const sessionTty = await this._resolveGhosttySessionTty({ pid })

    if (sessionTty === undefined) {
      return GhosttyFocusOutcomeMapper.MISSING
    }

    return this._focusGhosttyTerminalByTty({ sessionTty })
  }

  protected async _resolveGhosttySessionTty(params: { pid: number }): Promise<string | undefined> {
    const { pid } = params
    if (!(await this._resolveGhosttyTtySupport())) {
      return undefined
    }

    return this._resolveSessionTty({ pid })
  }

  protected async _resolveSessionTty(params: { pid: number }): Promise<string | undefined> {
    const { pid } = params
    try {
      const ancestry = await this._resolveAppBundleAncestry({ childPid: pid, hopCount: 0, pid })

      if (!this._isGhosttyBundle({ bundlePath: ancestry.bundlePath })) {
        return undefined
      }

      return await this._resolveProcessTtyPath({ pid: ancestry.hostPid })
    } catch {
      return undefined
    }
  }

  protected async _resolveGhosttyMatchRank(params: { cwd: string; pid: number }): Promise<number> {
    const { cwd, pid } = params
    const peers = await this._listGhosttyFocusPeers({ cwd, pid })

    return this._resolvePeerRank({ peers, pid })
  }

  protected async _listGhosttyFocusPeers(params: { cwd: string; pid: number }): Promise<GhosttyFocusPeer[]> {
    const { cwd, pid } = params
    const sameCwdSessions = await this._listSameCwdSessions({ cwd })
    const sessionPids = [
      pid,
      ...sameCwdSessions.map((session) => {
        return session.pid
      }),
    ]
    const peers = await Promise.all(
      [...new Set(sessionPids)].map((sessionPid) => {
        return this._resolveGhosttyFocusPeer({ pid: sessionPid })
      }),
    )

    return peers.filter((peer): peer is GhosttyFocusPeer => {
      return peer !== undefined
    })
  }

  protected async _listSameCwdSessions(params: { cwd: string }): Promise<SessionInfo[]> {
    const { cwd } = params
    const sessions = await this._runAgentsQuery()
      .then((stdout) => {
        return new SessionsParserService().parseSessionEntries({ stdout })
      })
      .catch(() => {
        return []
      })

    return sessions.filter((session) => {
      return session.cwd === cwd
    })
  }

  protected async _resolveGhosttyFocusPeer(params: { pid: number }): Promise<GhosttyFocusPeer | undefined> {
    const { pid } = params
    try {
      const ancestry = await this._resolveAppBundleAncestry({ childPid: pid, hopCount: 0, pid })

      if (!this._isGhosttyBundle({ bundlePath: ancestry.bundlePath })) {
        return undefined
      }

      return {
        hostPid: ancestry.hostPid,
        hostStartedAtMs: await this._resolveProcessStartTime({ pid: ancestry.hostPid }),
        pid,
      }
    } catch {
      return undefined
    }
  }

  protected _resolvePeerRank(params: { peers: GhosttyFocusPeer[]; pid: number }): number {
    const { peers, pid } = params
    const orderedPeers = [...peers].sort((left, right) => {
      const startDiff = this._resolvePeerStartMs(left) - this._resolvePeerStartMs(right)

      if (startDiff !== 0) {
        return startDiff
      }

      return left.hostPid - right.hostPid
    })
    const position = orderedPeers.findIndex((peer) => {
      return peer.pid === pid
    })

    if (position === -1) {
      return 0
    }

    return position
  }

  protected _resolvePeerStartMs(peer: GhosttyFocusPeer): number {
    if (peer.hostStartedAtMs === undefined) {
      return Number.MAX_SAFE_INTEGER
    }

    return peer.hostStartedAtMs
  }

  protected async _focusLinuxSession(params: { pid: number }): Promise<void> {
    const { pid } = params
    const windowId = await this._resolveLinuxWindowId({ hopCount: 0, pid })

    if (windowId === undefined) {
      throw new Error(this._resolveLinuxWindowNotFoundMessage())
    }

    await this._activateLinuxWindow({ windowId })
  }

  protected _resolveIsWaylandSession(): boolean {
    if (this._isWaylandSessionOverride !== undefined) {
      return this._isWaylandSessionOverride
    }

    return config.xdgSessionType === 'wayland' || config.waylandDisplay !== undefined
  }

  protected _resolveLinuxWindowNotFoundMessage(): string {
    if (this._resolveIsWaylandSession()) {
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

    const entry = await this._resolveProcessEntry({ pid })

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

  protected async _resolveIsFocusSupported(): Promise<boolean> {
    const platform = this._resolveFocusPlatform()

    if (platform !== OS.LINUX) {
      return true
    }

    return this._isLinuxFocusToolInstalled()
  }

  protected async _isLinuxFocusToolInstalled(): Promise<boolean> {
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

  protected async _installLinuxFocusTool(): Promise<void> {
    await execFileAsync('pkexec', ['apt', 'install', '-y', 'xdotool'], {
      timeout: FOCUS_TOOL_INSTALL_TIMEOUT_MS,
    })
  }

  protected _startSnapshotFetch(): Promise<SessionSnapshot> {
    const trackedPromise = this._fetchSnapshot().finally(() => {
      this._inFlightSnapshot = undefined
    })

    this._inFlightSnapshot = trackedPromise

    return trackedPromise
  }

  protected async _fetchSnapshot(): Promise<SessionSnapshot> {
    const stdout = await this._runAgentsQuery()

    return {
      fetchedAt: Date.now(),
      sessions: new SessionsParserService().sortSessions(new SessionsParserService().parseSessionEntries({ stdout })),
      unreachableHosts: [],
    }
  }

  protected async _runAgentsQuery(): Promise<string> {
    try {
      const { stdout } = await execFileAsync('claude', ['agents', '--json'], {
        env: this._resolveQueryEnv(),
        timeout: SESSIONS_QUERY_TIMEOUT_MS,
      })

      return stdout
    } catch (error) {
      throw new Error(`running 'claude agents --json' failed: ${this._resolveQueryErrorMessage(error)}`)
    }
  }

  protected _resolveQueryEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...rawEnvUtil.processEnv }

    env.PATH = `${homedir()}/.local/bin:${env.PATH ?? ''}`

    return env
  }

  protected _resolveQueryErrorMessage(error: unknown): string {
    const stderr = (error as { stderr?: unknown }).stderr

    if (typeof stderr === 'string' && stderr.trim() !== '') {
      return stderr.trim()
    }

    return errorUtil.resolveMessage(error)
  }

  protected async _resolveAppBundlePath(params: { hopCount: number; pid: number }): Promise<string> {
    const { hopCount, pid } = params
    const ancestry = await this._resolveAppBundleAncestry({
      childPid: pid,
      hopCount,
      pid,
    })

    return ancestry.bundlePath
  }

  protected async _resolveAppBundleAncestry(params: {
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

    const entry = await this._resolveProcessEntry({ pid })

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

    return this._resolveAppBundleAncestry({
      childPid: pid,
      hopCount: hopCount + 1,
      pid: entry.ppid,
    })
  }

  protected async _resolveProcessEntry(params: { pid: number }): Promise<ProcessEntry | undefined> {
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

  protected async _resolveProcessStartTime(params: { pid: number }): Promise<number | undefined> {
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

  protected _parseStartTime(params: { stdout: string }): number | undefined {
    const { stdout } = params
    const startedAtMs = Date.parse(stdout.trim())

    if (Number.isNaN(startedAtMs)) {
      return undefined
    }

    return startedAtMs
  }

  protected async _resolveProcessTtyPath(params: { pid: number }): Promise<string | undefined> {
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

  protected _resolveAppBundleFromComm(params: { comm: string }): string | undefined {
    const { comm } = params
    const match = constant.appBundleRegex.exec(comm)

    if (match === null) {
      return undefined
    }

    return match[1]
  }

  protected async _activateAppBundle(params: { bundlePath: string }): Promise<void> {
    const { bundlePath } = params
    try {
      await execFileAsync('open', ['-a', bundlePath], { timeout: OPEN_APP_TIMEOUT_MS })
    } catch (error) {
      throw new Error(`activating '${bundlePath}' failed: ${errorUtil.resolveMessage(error)}`)
    }
  }

  protected _isGhosttyBundle(params: { bundlePath: string }): boolean {
    const { bundlePath } = params

    return basename(bundlePath) === 'Ghostty.app'
  }

  protected async _focusGhosttyTab(params: { cwd: string; matchRank: number }): Promise<GhosttyFocusOutcomeMapper> {
    const { cwd, matchRank } = params
    try {
      const { stdout } = await execFileAsync(
        'osascript',
        ['-e', GHOSTTY_TAB_FOCUS_SCRIPT, '--', cwd, String(matchRank)],
        {
          timeout: OSASCRIPT_TIMEOUT_MS,
        },
      )

      return this._parseGhosttyFocusOutcome({ stdout })
    } catch (error) {
      throw new Error(this._resolveGhosttyFocusErrorMessage({ error }))
    }
  }

  protected _parseGhosttyFocusOutcome(params: { stdout: string }): GhosttyFocusOutcomeMapper {
    const { stdout } = params
    switch (stdout.trim()) {
      case 'focused': {
        return GhosttyFocusOutcomeMapper.FOCUSED
      }

      case 'hidden': {
        return GhosttyFocusOutcomeMapper.HIDDEN
      }

      default: {
        return GhosttyFocusOutcomeMapper.MISSING
      }
    }
  }

  protected _resolveGhosttyFocusErrorMessage(params: { error: unknown }): string {
    const { error } = params
    if (this._isAutomationDenied({ error })) {
      return GHOSTTY_AUTOMATION_DENIED_MESSAGE
    }

    return `focusing the Ghostty tab failed: ${this._resolveQueryErrorMessage(error)}`
  }

  protected async _focusGhosttyTerminalByTty(params: { sessionTty: string }): Promise<GhosttyFocusOutcomeMapper> {
    const { sessionTty } = params
    try {
      const { stdout } = await execFileAsync('osascript', ['-e', GHOSTTY_TTY_FOCUS_SCRIPT, '--', sessionTty], {
        timeout: OSASCRIPT_TIMEOUT_MS,
      })

      return this._parseGhosttyFocusOutcome({ stdout })
    } catch (error) {
      throw new Error(this._resolveGhosttyFocusErrorMessage({ error }))
    }
  }

  protected _resolveGhosttyTtySupport(): Promise<boolean> {
    this._ghosttyTtySupport ??= this._probeGhosttyTtySupport()

    return this._ghosttyTtySupport
  }

  protected async _probeGhosttyTtySupport(): Promise<boolean> {
    try {
      await execFileAsync('osascript', ['-e', GHOSTTY_TTY_SUPPORT_PROBE_SCRIPT], {
        timeout: OSASCRIPT_TIMEOUT_MS,
      })

      return true
    } catch {
      return false
    }
  }

  protected _isVsCodeBundle(params: { bundlePath: string }): boolean {
    const { bundlePath } = params

    return basename(bundlePath) === VSCODE_BUNDLE_BASENAME
  }

  protected async _focusVsCodeWindow(params: { bundlePath: string; cwd: string }): Promise<void> {
    const { bundlePath, cwd } = params
    const windowTitles = await this._listVsCodeWindowTitles({ bundlePath })
    const windowIndex = this._resolveVsCodeWindowIndex({ cwd, windowTitles })

    if (windowIndex === undefined) {
      return
    }

    await this._raiseVsCodeWindow({ bundlePath, windowIndex })
  }

  protected async _listVsCodeWindowTitles(params: { bundlePath: string }): Promise<string[]> {
    const { bundlePath } = params
    try {
      const { stdout } = await execFileAsync('osascript', ['-e', VSCODE_WINDOW_TITLES_SCRIPT, '--', bundlePath], {
        timeout: OSASCRIPT_TIMEOUT_MS,
      })

      return this._parseVsCodeWindowTitles({ stdout })
    } catch (error) {
      const deniedMessage = this._resolveVsCodePermissionDeniedMessage({ error })

      if (deniedMessage !== undefined) {
        throw new Error(deniedMessage)
      }

      throw new Error(`listing the VS Code windows failed: ${this._resolveQueryErrorMessage(error)}`)
    }
  }

  protected _parseVsCodeWindowTitles(params: { stdout: string }): string[] {
    const { stdout } = params

    return stdout
      .trim()
      .split('\n')
      .filter((line) => {
        return line !== ''
      })
  }

  protected _resolveVsCodeWindowIndex(params: { cwd: string; windowTitles: string[] }): number | undefined {
    const { cwd, windowTitles } = params
    const workspaceNames = this._resolveVsCodeWorkspaceNameCandidates({ cwd })
    const firstMatchedPosition = workspaceNames
      .map((workspaceName) => {
        return windowTitles.findIndex((windowTitle) => {
          return this._resolveVsCodeWorkspaceName({ windowTitle }) === workspaceName
        })
      })
      .find((windowPosition) => {
        return windowPosition !== -1
      })

    if (firstMatchedPosition === undefined) {
      return undefined
    }

    return firstMatchedPosition + 1
  }

  protected _resolveVsCodeWorkspaceName(params: { windowTitle: string }): string {
    const { windowTitle } = params
    const titleParts = windowTitle.split(VSCODE_TITLE_SEPARATOR)
    const lastTitlePart = titleParts[titleParts.length - 1]

    if (lastTitlePart === undefined) {
      return windowTitle
    }

    return lastTitlePart
  }

  protected _resolveVsCodeWorkspaceNameCandidates(params: { cwd: string }): string[] {
    const { cwd } = params

    return cwd
      .split('/')
      .filter((pathPart) => {
        return pathPart !== ''
      })
      .slice(-MAX_VSCODE_WORKSPACE_NAME_CANDIDATES)
      .reverse()
  }

  protected async _raiseVsCodeWindow(params: { bundlePath: string; windowIndex: number }): Promise<void> {
    const { bundlePath, windowIndex } = params
    try {
      await execFileAsync('osascript', ['-e', VSCODE_WINDOW_RAISE_SCRIPT, '--', bundlePath, String(windowIndex)], {
        timeout: OSASCRIPT_TIMEOUT_MS,
      })
    } catch (error) {
      const deniedMessage = this._resolveVsCodePermissionDeniedMessage({ error })

      if (deniedMessage !== undefined) {
        throw new Error(deniedMessage)
      }

      throw new Error(`raising the VS Code window failed: ${this._resolveQueryErrorMessage(error)}`)
    }
  }

  protected _resolveVsCodePermissionDeniedMessage(params: { error: unknown }): string | undefined {
    const { error } = params
    if (this._isAutomationDenied({ error })) {
      return VSCODE_SYSTEM_EVENTS_DENIED_MESSAGE
    }

    if (this._isAssistiveAccessDenied({ error })) {
      return VSCODE_ACCESSIBILITY_DENIED_MESSAGE
    }

    return undefined
  }

  protected _isAssistiveAccessDenied(params: { error: unknown }): boolean {
    const { error } = params

    return this._resolveQueryErrorMessage(error).includes('assistive access')
  }

  protected _isAutomationDenied(params: { error: unknown }): boolean {
    const { error } = params
    const message = this._resolveQueryErrorMessage(error)

    return message.includes('Not authorized') || message.includes('-1743')
  }
}

export const sessionsServiceSingleton = singletonPattern(() => {
  return new _SessionsService()
})
