import { singletonPattern, typeUtil } from '@beecode/msh-util'

import { GhosttyFocusOutcomeMapper } from '#src/main/business/enum/ghostty-focus-outcome-mapper-enum'
import { SessionsClaudeQueryService } from '#src/main/business/service/sessions/claude-query-service'
import { SessionsFocusGhosttyCompatService } from '#src/main/business/service/sessions/focus/ghostty-compat-service'
import {
  type GhosttyFocusPeer,
  SessionsFocusGhosttyService,
} from '#src/main/business/service/sessions/focus/ghostty-service'
import { SessionsFocusLinuxService } from '#src/main/business/service/sessions/focus/linux-service'
import { SessionsFocusMacOsService } from '#src/main/business/service/sessions/focus/macos-service'
import { SessionsFocusVsCodeService } from '#src/main/business/service/sessions/focus/vscode-service'
import { SessionsParserService } from '#src/main/business/service/sessions/parser-service'
import { SessionsProcessService } from '#src/main/business/service/sessions/process-service'
import { config } from '#src/main/util/config'
import { errorUtil } from '#src/main/util/error-util'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'
import { type SessionInfo, type SessionSnapshot } from '#src/shared/business/model/session-model'

const GHOSTTY_OTHER_DESKTOP_MESSAGE =
  'the terminal is on another desktop or minimized; to let focus jump to it, enable "When switching to an application, switch to a Space with open windows for the application" in System Settings > Desktop & Dock'

export class _SessionsService {
  protected _ghosttyTtySupport: Promise<boolean> | undefined
  protected _inFlightSnapshot: Promise<SessionSnapshot> | undefined
  protected _isFocusSupported: Promise<boolean> | undefined
  protected readonly _isWaylandSessionOverride: boolean | undefined
  protected readonly _claudeQueryService = new SessionsClaudeQueryService()
  protected readonly _ghosttyCompatService = new SessionsFocusGhosttyCompatService()
  protected readonly _ghosttyService = new SessionsFocusGhosttyService()
  protected readonly _linuxService = new SessionsFocusLinuxService()
  protected readonly _macOsService = new SessionsFocusMacOsService()
  protected readonly _processService = new SessionsProcessService()
  protected readonly _vsCodeService = new SessionsFocusVsCodeService()

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

    if (cwd !== '' && this._macOsService.isGhosttyBundle({ bundlePath })) {
      return this._focusGhosttySession({ bundlePath, cwd, pid })
    }

    await this._activateAppBundle({ bundlePath })

    if (cwd === '') {
      return
    }

    if (this._macOsService.isVsCodeBundle({ bundlePath })) {
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
      const ancestry = await this._processService.resolveAppBundleAncestry({ childPid: pid, hopCount: 0, pid })

      if (!this._macOsService.isGhosttyBundle({ bundlePath: ancestry.bundlePath })) {
        return undefined
      }

      return await this._processService.resolveProcessTtyPath({ pid: ancestry.hostPid })
    } catch {
      return undefined
    }
  }

  protected async _resolveGhosttyMatchRank(params: { cwd: string; pid: number }): Promise<number> {
    const { cwd, pid } = params
    const peers = await this._listGhosttyFocusPeers({ cwd, pid })

    return this._ghosttyService.resolvePeerRank({ peers, pid })
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
      const ancestry = await this._processService.resolveAppBundleAncestry({ childPid: pid, hopCount: 0, pid })

      if (!this._macOsService.isGhosttyBundle({ bundlePath: ancestry.bundlePath })) {
        return undefined
      }

      return {
        hostPid: ancestry.hostPid,
        hostStartedAtMs: await this._processService.resolveProcessStartTime({ pid: ancestry.hostPid }),
        pid,
      }
    } catch {
      return undefined
    }
  }

  protected async _focusLinuxSession(params: { pid: number }): Promise<void> {
    const { pid } = params
    await this._linuxService.focusSession({ isWaylandSession: this._resolveIsWaylandSession(), pid })
  }

  protected _resolveIsWaylandSession(): boolean {
    if (this._isWaylandSessionOverride !== undefined) {
      return this._isWaylandSessionOverride
    }

    return config.xdgSessionType === 'wayland' || config.waylandDisplay !== undefined
  }

  protected async _resolveIsFocusSupported(): Promise<boolean> {
    const platform = this._resolveFocusPlatform()

    if (platform !== OS.LINUX) {
      return true
    }

    return await this._isLinuxFocusToolInstalled()
  }

  protected _isLinuxFocusToolInstalled(): Promise<boolean> {
    return this._linuxService.isFocusToolInstalled()
  }

  protected _installLinuxFocusTool(): Promise<void> {
    return this._linuxService.installFocusTool()
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

  protected _runAgentsQuery(): Promise<string> {
    return this._claudeQueryService.runAgentsQuery()
  }

  protected async _resolveAppBundlePath(params: { hopCount: number; pid: number }): Promise<string> {
    const { hopCount, pid } = params
    const ancestry = await this._processService.resolveAppBundleAncestry({
      childPid: pid,
      hopCount,
      pid,
    })

    return ancestry.bundlePath
  }

  protected _activateAppBundle(params: { bundlePath: string }): Promise<void> {
    return this._macOsService.activateAppBundle(params)
  }

  protected async _focusGhosttyTab(params: { cwd: string; matchRank: number }): Promise<GhosttyFocusOutcomeMapper> {
    const { cwd, matchRank } = params
    try {
      const stdout = await this._ghosttyService.focusGhosttyTab({ cwd, matchRank })

      return this._ghosttyService.parseGhosttyFocusOutcome({ stdout })
    } catch (error) {
      throw new Error(this._ghosttyService.resolveFocusErrorMessage({ error }))
    }
  }

  protected async _focusGhosttyTerminalByTty(params: { sessionTty: string }): Promise<GhosttyFocusOutcomeMapper> {
    const { sessionTty } = params
    try {
      const stdout = await this._ghosttyService.focusGhosttyTerminalByTty({ sessionTty })

      return this._ghosttyService.parseGhosttyFocusOutcome({ stdout })
    } catch (error) {
      throw new Error(this._ghosttyService.resolveFocusErrorMessage({ error }))
    }
  }

  protected _resolveGhosttyTtySupport(): Promise<boolean> {
    this._ghosttyTtySupport ??= this._ghosttyCompatService.isTtySupported()

    return this._ghosttyTtySupport
  }

  protected _focusVsCodeWindow(params: { bundlePath: string; cwd: string }): Promise<void> {
    return this._vsCodeService.focusWindow(params)
  }
}

export const sessionsServiceSingleton = singletonPattern(() => {
  return new _SessionsService()
})
