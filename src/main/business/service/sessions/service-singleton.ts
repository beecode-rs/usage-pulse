import { singletonPattern, typeUtil } from '@beecode/msh-util'

import { GhosttyFocusOutcomeMapper } from '#src/main/business/enum/ghostty-focus-outcome-mapper-enum'
import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { SessionsClaudeQueryService } from '#src/main/business/service/sessions/claude-query-service'
import { SessionsFocusGhosttyCompatService } from '#src/main/business/service/sessions/focus/ghostty-compat-service'
import {
  type SessionsFocusGhosttyPeer,
  SessionsFocusGhosttyService,
} from '#src/main/business/service/sessions/focus/ghostty-service'
import { SessionsFocusLinuxService } from '#src/main/business/service/sessions/focus/linux-service'
import { SessionsFocusMacOsService } from '#src/main/business/service/sessions/focus/macos-service'
import { SessionsFocusTmuxCompanionService } from '#src/main/business/service/sessions/focus/tmux-companion-service'
import { SessionsFocusTmuxLocateService } from '#src/main/business/service/sessions/focus/tmux-locate-service'
import { SessionsFocusVsCodeService } from '#src/main/business/service/sessions/focus/vscode-service'
import { SessionsOpenCodeParserService } from '#src/main/business/service/sessions/opencode-parser-service'
import { SessionsOpenCodeQueryService } from '#src/main/business/service/sessions/opencode-query-service'
import { SessionsParserService } from '#src/main/business/service/sessions/parser-service'
import { SessionsProcessService } from '#src/main/business/service/sessions/process-service'
import { config } from '#src/main/util/config'
import { constant } from '#src/main/util/constant'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'
import { type SessionInfo, type SessionSnapshot } from '#src/shared/business/model/session-model'
import { type SshHostConfig } from '#src/shared/business/model/settings-model'
import { errorUtil } from '#src/shared/util/error-util'

export type SessionsTmuxClientOwner = {
  bundlePath: string
  clientTty: string
}

export class _SessionsService {
  protected _ghosttyTtySupport: Promise<boolean> | undefined
  protected _inFlightSnapshot: Promise<SessionSnapshot> | undefined
  protected _isFocusSupportedCache: Promise<boolean> | undefined
  protected readonly _isWaylandSessionOverride: boolean | undefined
  protected readonly _claudeQueryService = new SessionsClaudeQueryService()
  protected readonly _ghosttyCompatService = new SessionsFocusGhosttyCompatService()
  protected readonly _ghosttyService = new SessionsFocusGhosttyService()
  protected readonly _linuxService = new SessionsFocusLinuxService()
  protected readonly _macOsService = new SessionsFocusMacOsService()
  protected readonly _openCodeParserService = new SessionsOpenCodeParserService()
  protected readonly _openCodeQueryService = new SessionsOpenCodeQueryService()
  protected readonly _processService = new SessionsProcessService()
  protected readonly _tmuxCompanionService = new SessionsFocusTmuxCompanionService()
  protected readonly _tmuxLocateService = new SessionsFocusTmuxLocateService()
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

  async focusSession(params: { cwd: string; hostId?: string; name?: string; pid?: number }): Promise<void> {
    const { cwd, hostId, name, pid } = params
    if (hostId !== undefined) {
      return this._focusRemoteSession({ cwd, hostId, name, pid })
    }

    if (pid === undefined && cwd === '') {
      throw new Error('focusing a local session terminal requires a session pid or working directory')
    }

    await this._focusSessionForPlatform({
      cwd,
      name,
      pid,
      platform: this._resolveFocusPlatform(),
    })
  }

  isFocusSupported(): Promise<boolean> {
    this._isFocusSupportedCache ??= this._isFocusSupported()

    return this._isFocusSupportedCache
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

    this._isFocusSupportedCache = undefined
  }

  protected _resolveFocusPlatform(): OS {
    return osUtil.resolvePlatform()
  }

  protected async _focusSessionForPlatform(params: {
    cwd: string
    name?: string
    pid?: number
    platform: OS
  }): Promise<void> {
    const { cwd, name, pid, platform } = params
    switch (platform) {
      case OS.LINUX: {
        return this._focusLinuxSession({ cwd, name, pid })
      }

      case OS.MACOS: {
        return this._focusMacOsSession({ cwd, name, pid })
      }

      case OS.WINDOWS: {
        throw new Error('focusing a session terminal is only supported on macOS and Linux')
      }

      default: {
        throw typeUtil.exhaustiveError('unsupported platform [platform]', platform)
      }
    }
  }

  protected async _focusMacOsSession(params: { cwd: string; name?: string; pid?: number }): Promise<void> {
    const { cwd, name, pid } = params

    if (pid !== undefined) {
      return this._focusMacOsSessionByPid({ cwd, pid })
    }

    return this._focusPidLessLocalSession({ cwd, name })
  }

  protected async _focusPidLessLocalSession(params: { cwd: string; name?: string }): Promise<void> {
    const { cwd, name } = params
    const sessionName = await this._resolveLocalTmuxSessionName({ cwd, name })

    if (sessionName !== undefined) {
      return this._focusLocalTmuxFocusedSession({ cwd, sessionName })
    }

    const resolvedPid = await this._resolveLocalPidByCwd({ cwd })

    if (resolvedPid === undefined) {
      throw new Error(constant.sessions.focus.tmux.localSessionNotFoundMessage)
    }

    return this._focusSessionByPlatformPid({ cwd, pid: resolvedPid })
  }

  protected async _focusSessionByPlatformPid(params: { cwd: string; pid: number }): Promise<void> {
    const { cwd, pid } = params
    const platform = this._resolveFocusPlatform()
    switch (platform) {
      case OS.LINUX: {
        return this._focusLinuxSessionByPid({ cwd, pid })
      }

      case OS.MACOS: {
        return this._focusMacOsSessionByPid({ cwd, pid })
      }

      case OS.WINDOWS: {
        throw new Error('focusing a session terminal is only supported on macOS and Linux')
      }

      default: {
        throw typeUtil.exhaustiveError('unsupported platform [platform]', platform)
      }
    }
  }

  protected _resolveLocalPidByCwd(params: { cwd: string }): Promise<number | undefined> {
    return this._processService.resolveMostRecentPidByCwd(params)
  }

  protected async _focusMacOsSessionByPid(params: { cwd: string; pid: number }): Promise<void> {
    const { cwd, pid } = params
    const bundlePath = await this._resolveAppBundlePathWithTmuxFallback({ cwd, pid })

    if (bundlePath === undefined) {
      return
    }

    return this._focusAppBundleSession({ bundlePath, cwd, pid })
  }

  protected async _resolveAppBundlePathWithTmuxFallback(params: {
    cwd: string
    pid: number
  }): Promise<string | undefined> {
    const { cwd, pid } = params

    try {
      return await this._resolveAppBundlePath({ hopCount: 0, pid })
    } catch (error) {
      await this._focusLocalTmuxSession({ cwd, fallbackError: error, pid })

      return undefined
    }
  }

  protected async _focusAppBundleSession(params: { bundlePath: string; cwd: string; pid: number }): Promise<void> {
    const { bundlePath, cwd, pid } = params

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
        throw new Error(constant.sessions.focus.ghostty.otherDesktopMessage)
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
    if (!(await this._isGhosttyTtySupported())) {
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

  protected async _listGhosttyFocusPeers(params: { cwd: string; pid: number }): Promise<SessionsFocusGhosttyPeer[]> {
    const { cwd, pid } = params
    const sameCwdSessions = await this._listSameCwdSessions({ cwd })
    const sameCwdPids = sameCwdSessions
      .map((session) => {
        return session.pid
      })
      .filter((sessionPid): sessionPid is number => {
        return sessionPid !== undefined
      })
    const sessionPids = [pid, ...sameCwdPids]
    const peers = await Promise.all(
      [...new Set(sessionPids)].map((sessionPid) => {
        return this._resolveGhosttyFocusPeer({ pid: sessionPid })
      }),
    )

    return peers.filter((peer): peer is SessionsFocusGhosttyPeer => {
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

  protected async _resolveGhosttyFocusPeer(params: { pid: number }): Promise<SessionsFocusGhosttyPeer | undefined> {
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

  protected async _focusLinuxSession(params: { cwd: string; name?: string; pid?: number }): Promise<void> {
    const { cwd, name, pid } = params

    if (pid !== undefined) {
      return this._focusLinuxSessionByPid({ cwd, pid })
    }

    return this._focusPidLessLocalSession({ cwd, name })
  }

  protected async _focusLinuxSessionByPid(params: { cwd: string; pid: number }): Promise<void> {
    const { cwd, pid } = params
    const isWindowFocused = await this._linuxService.tryFocusSession({ pid })

    if (isWindowFocused) {
      return
    }

    return this._focusLocalTmuxSession({
      cwd,
      fallbackError: new Error(
        this._linuxService.resolveWindowNotFoundMessage({ isWaylandSession: this._isWaylandSession() }),
      ),
      pid,
    })
  }

  protected async _focusRemoteSession(params: {
    cwd: string
    hostId: string
    name?: string
    pid?: number
  }): Promise<void> {
    const { cwd, hostId, name, pid } = params
    const host = this._resolveSshHost({ hostId })
    const sessionName = await this._resolveRemoteTmuxSessionName({ cwd, host, name, pid })

    if (sessionName === undefined) {
      throw new Error(constant.sessions.focus.tmux.remoteSessionNotFoundMessage)
    }

    return this._focusTmuxCompanionSession({ host, sessionName })
  }

  protected _resolveSshHost(params: { hostId: string }): SshHostConfig {
    const { hostId } = params
    const host = settingsRepoSingleton()
      .fetch()
      .sshHosts.find((sshHost) => {
        return sshHost.id === hostId
      })

    if (host === undefined) {
      throw new Error(`cannot focus the remote session: the ssh host '${hostId}' is no longer configured`)
    }

    return host
  }

  protected async _focusLocalTmuxSession(params: {
    cwd: string
    fallbackError?: unknown
    pid?: number
  }): Promise<void> {
    const { cwd, fallbackError, pid } = params
    const sessionName = await this._resolveLocalTmuxSessionName({ cwd, pid })

    if (sessionName === undefined) {
      throw this._toTmuxFallbackError({ fallbackError })
    }

    return this._focusLocalTmuxFocusedSession({ cwd, sessionName })
  }

  protected async _focusLocalTmuxFocusedSession(params: { cwd: string; sessionName: string }): Promise<void> {
    const { cwd, sessionName } = params

    if (this._resolveFocusPlatform() === OS.MACOS) {
      const isClientFocused = await this._focusTmuxClientTerminal({ cwd, sessionName })

      if (isClientFocused) {
        return
      }
    }

    return this._focusTmuxCompanionSession({ sessionName })
  }

  protected _toTmuxFallbackError(params: { fallbackError?: unknown }): unknown {
    const { fallbackError } = params
    if (fallbackError !== undefined) {
      return fallbackError
    }

    return new Error(constant.sessions.focus.tmux.localSessionNotFoundMessage)
  }

  protected async _focusTmuxClientTerminal(params: { cwd: string; sessionName: string }): Promise<boolean> {
    const { cwd, sessionName } = params
    const clientTtys = await this._listTmuxClientTtys({ sessionName })
    const clientOwners = await Promise.all(
      clientTtys.map((clientTty) => {
        return this._resolveTmuxClientOwner({ clientTty })
      }),
    )
    const knownOwners = clientOwners.filter((clientOwner): clientOwner is SessionsTmuxClientOwner => {
      return clientOwner !== undefined
    })
    const orderedOwners = [...knownOwners].sort((left, right) => {
      return this._resolveTmuxClientRank(left) - this._resolveTmuxClientRank(right)
    })

    return this._focusNextTmuxClient({ clientOwners: orderedOwners, cwd, index: 0 })
  }

  protected _listTmuxClientTtys(params: { sessionName: string }): Promise<string[]> {
    return this._tmuxLocateService.listLocalSessionClientTtys(params)
  }

  protected async _resolveTmuxClientOwner(params: { clientTty: string }): Promise<SessionsTmuxClientOwner | undefined> {
    const { clientTty } = params
    const clientPid = await this._tmuxLocateService.resolveLocalTtyPid({ ttyPath: clientTty })

    if (clientPid === undefined) {
      return undefined
    }

    try {
      const ancestry = await this._processService.resolveAppBundleAncestry({
        childPid: clientPid,
        hopCount: 0,
        pid: clientPid,
      })

      return { bundlePath: ancestry.bundlePath, clientTty }
    } catch {
      return undefined
    }
  }

  protected _resolveTmuxClientRank(params: { bundlePath: string }): number {
    const { bundlePath } = params
    if (this._macOsService.isGhosttyBundle({ bundlePath })) {
      return 0
    }

    if (this._macOsService.isTerminalAppBundle({ bundlePath })) {
      return 1
    }

    if (this._macOsService.isVsCodeBundle({ bundlePath })) {
      return 2
    }

    return 3
  }

  protected async _focusNextTmuxClient(params: {
    clientOwners: SessionsTmuxClientOwner[]
    cwd: string
    index: number
  }): Promise<boolean> {
    const { clientOwners, cwd, index } = params
    const clientOwner = clientOwners[index]

    if (clientOwner === undefined) {
      return false
    }

    if (await this._focusTmuxClientOwnerApp({ clientOwner, cwd })) {
      return true
    }

    return this._focusNextTmuxClient({ clientOwners, cwd, index: index + 1 })
  }

  protected async _focusTmuxClientOwnerApp(params: {
    clientOwner: SessionsTmuxClientOwner
    cwd: string
  }): Promise<boolean> {
    const { clientOwner, cwd } = params
    const { bundlePath, clientTty } = clientOwner

    if (!this._macOsService.isGhosttyBundle({ bundlePath })) {
      await this._activateAppBundle({ bundlePath })

      if (this._macOsService.isVsCodeBundle({ bundlePath })) {
        await this._focusVsCodeWindow({ bundlePath, cwd })
      }

      return true
    }

    const outcome = await this._focusGhosttyTerminalByTty({ sessionTty: clientTty })

    if (outcome === GhosttyFocusOutcomeMapper.HIDDEN) {
      throw new Error(constant.sessions.focus.ghostty.otherDesktopMessage)
    }

    return outcome === GhosttyFocusOutcomeMapper.FOCUSED
  }

  protected _resolveLocalTmuxSessionName(params: {
    cwd: string
    name?: string
    pid?: number
  }): Promise<string | undefined> {
    return this._tmuxLocateService.resolveLocalSessionName(params)
  }

  protected _resolveRemoteTmuxSessionName(params: {
    cwd: string
    host: SshHostConfig
    name?: string
    pid?: number
  }): Promise<string | undefined> {
    return this._tmuxLocateService.resolveRemoteSessionName(params)
  }

  protected _focusTmuxCompanionSession(params: { host?: SshHostConfig; sessionName: string }): Promise<void> {
    return this._tmuxCompanionService.focusSession(params)
  }

  protected _isWaylandSession(): boolean {
    if (this._isWaylandSessionOverride !== undefined) {
      return this._isWaylandSessionOverride
    }

    return config.xdg.sessionType === 'wayland' || config.waylandDisplay !== undefined
  }

  protected async _isFocusSupported(): Promise<boolean> {
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
    const [stdout, openCodeSessions] = await Promise.all([this._runAgentsQuery(), this._fetchOpenCodeSessions()])
    const claudeSessions = new SessionsParserService().parseSessionEntries({ stdout })

    return {
      fetchedAt: Date.now(),
      sessions: new SessionsParserService().sortSessions({
        sessions: [...claudeSessions, ...openCodeSessions],
      }),
      unreachableHosts: [],
    }
  }

  protected async _fetchOpenCodeSessions(): Promise<SessionInfo[]> {
    try {
      const openCodePayload = await this._openCodeQueryService.fetchSessions()

      if (openCodePayload === undefined) {
        return []
      }

      return this._openCodeParserService.parseSessions({ ...openCodePayload, nowMs: Date.now() })
    } catch {
      return []
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

  protected _isGhosttyTtySupported(): Promise<boolean> {
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
