import { GhosttyFocusOutcomeMapper } from '#src/main/business/enum/ghostty-focus-outcome-mapper-enum'
import { type SessionsFocusGhosttyPeer } from '#src/main/business/service/sessions/focus/ghostty-service'
import { type SessionsTmuxClientOwner, _SessionsService } from '#src/main/business/service/sessions/service-singleton'
import { type OS } from '#src/shared/business/enum/os-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'
import { type SshHostConfig } from '#src/shared/business/model/settings-model'

export class SessionsServiceContractHarness extends _SessionsService {
  isLinuxFocusToolInstalled: boolean | undefined
  isMacOsGhosttyPeersStubbed = true
  isMacOsGhosttySessionTtyStubbed = true
  isMacOsWindowFocusStubbed = true
  linuxFocusToolInstallAttemptCount = 0
  linuxFocusToolInstallError: Error | undefined
  localPidByCwd: number | undefined
  localTmuxClientTtys: string[] = []
  localTmuxSessionName: string | undefined
  macOsAgentsQueryStdout: string | undefined
  macOsBundleResolveError: Error | undefined
  macOsGhosttyFocusPeers: SessionsFocusGhosttyPeer[] = []
  macOsGhosttySessionTty: string | undefined
  macOsGhosttyTabFocusOutcome: GhosttyFocusOutcomeMapper = GhosttyFocusOutcomeMapper.FOCUSED
  macOsGhosttyTtyFocusOutcome: GhosttyFocusOutcomeMapper = GhosttyFocusOutcomeMapper.MISSING
  macOsGhosttyTtySupport = false
  macOsTmuxClientBundlePathByTty: Record<string, string> = {}
  openCodeSessions: SessionInfo[] | undefined
  readonly companionFocusCalls: { host?: SshHostConfig; sessionName: string }[] = []
  readonly localPidByCwdResolveCalls: { cwd: string }[] = []
  readonly localTmuxSessionResolveCalls: { cwd: string; name?: string; pid?: number }[] = []
  readonly macOsBundleActivateCalls: { bundlePath: string }[] = []
  readonly macOsBundleResolveCalls: { hopCount: number; pid: number }[] = []
  readonly macOsTabFocusCalls: { cwd: string; matchRank: number }[] = []
  readonly macOsTtyFocusCalls: { sessionTty: string }[] = []
  readonly macOsWindowFocusCalls: { bundlePath: string; cwd: string }[] = []
  readonly remoteTmuxSessionResolveCalls: { cwd: string; host: SshHostConfig; name?: string; pid?: number }[] = []
  remoteTmuxSessionName: string | undefined
  sshHostsById: Record<string, SshHostConfig> = {}
  protected readonly _focusPlatformOverride: OS | undefined
  protected readonly _macOsBundlePath: string

  constructor(params: { focusPlatform?: OS; isWaylandSession?: boolean; macOsBundlePath?: string } = {}) {
    const { focusPlatform, isWaylandSession, macOsBundlePath } = params
    super({ isWaylandSession })
    this._focusPlatformOverride = focusPlatform
    this._macOsBundlePath = macOsBundlePath ?? '/Applications/Ghostty.app'
  }

  protected override _resolveFocusPlatform(): OS {
    if (this._focusPlatformOverride === undefined) {
      return super._resolveFocusPlatform()
    }

    return this._focusPlatformOverride
  }

  protected override _activateAppBundle(params: { bundlePath: string }): Promise<void> {
    const { bundlePath } = params
    this.macOsBundleActivateCalls.push({ bundlePath })

    return Promise.resolve()
  }

  protected override _resolveAppBundlePath(params: { hopCount: number; pid: number }): Promise<string> {
    const { hopCount, pid } = params
    this.macOsBundleResolveCalls.push({ hopCount, pid })

    if (this.macOsBundleResolveError !== undefined) {
      return Promise.reject(this.macOsBundleResolveError)
    }

    return Promise.resolve(this._macOsBundlePath)
  }

  protected override _resolveLocalPidByCwd(params: { cwd: string }): Promise<number | undefined> {
    this.localPidByCwdResolveCalls.push(params)

    return Promise.resolve(this.localPidByCwd)
  }

  protected override _resolveLocalTmuxSessionName(params: {
    cwd: string
    name?: string
    pid?: number
  }): Promise<string | undefined> {
    this.localTmuxSessionResolveCalls.push(params)

    return Promise.resolve(this.localTmuxSessionName)
  }

  protected override _resolveRemoteTmuxSessionName(params: {
    cwd: string
    host: SshHostConfig
    name?: string
    pid?: number
  }): Promise<string | undefined> {
    this.remoteTmuxSessionResolveCalls.push(params)

    return Promise.resolve(this.remoteTmuxSessionName)
  }

  protected override _focusTmuxCompanionSession(params: { host?: SshHostConfig; sessionName: string }): Promise<void> {
    this.companionFocusCalls.push(params)

    return Promise.resolve()
  }

  protected override _listTmuxClientTtys(params: { sessionName: string }): Promise<string[]> {
    return Promise.resolve(this.localTmuxClientTtys)
  }

  protected override _resolveTmuxClientOwner(params: {
    clientTty: string
  }): Promise<SessionsTmuxClientOwner | undefined> {
    const bundlePath = this.macOsTmuxClientBundlePathByTty[params.clientTty]

    if (bundlePath === undefined) {
      return Promise.resolve(undefined)
    }

    return Promise.resolve({ bundlePath, clientTty: params.clientTty })
  }

  protected override _resolveSshHost(params: { hostId: string }): SshHostConfig {
    const host = this.sshHostsById[params.hostId]

    if (host === undefined) {
      throw new Error(`cannot focus the remote session: the ssh host '${params.hostId}' is no longer configured`)
    }

    return host
  }

  protected override async _runAgentsQuery(): Promise<string> {
    if (this.macOsAgentsQueryStdout === undefined) {
      return super._runAgentsQuery()
    }

    return this.macOsAgentsQueryStdout
  }

  protected override _fetchOpenCodeSessions(): Promise<SessionInfo[]> {
    if (this.openCodeSessions === undefined) {
      return Promise.resolve([])
    }

    return Promise.resolve(this.openCodeSessions)
  }

  protected override _isGhosttyTtySupported(): Promise<boolean> {
    return Promise.resolve(this.macOsGhosttyTtySupport)
  }

  protected override async _resolveSessionTty(params: { pid: number }): Promise<string | undefined> {
    if (!this.isMacOsGhosttySessionTtyStubbed) {
      return super._resolveSessionTty(params)
    }

    return this.macOsGhosttySessionTty
  }

  protected override async _listGhosttyFocusPeers(params: {
    cwd: string
    pid: number
  }): Promise<SessionsFocusGhosttyPeer[]> {
    if (!this.isMacOsGhosttyPeersStubbed) {
      return super._listGhosttyFocusPeers(params)
    }

    return this.macOsGhosttyFocusPeers
  }

  protected override _focusGhosttyTab(params: { cwd: string; matchRank: number }): Promise<GhosttyFocusOutcomeMapper> {
    const { cwd, matchRank } = params
    this.macOsTabFocusCalls.push({ cwd, matchRank })

    return Promise.resolve(this.macOsGhosttyTabFocusOutcome)
  }

  protected override _focusGhosttyTerminalByTty(params: { sessionTty: string }): Promise<GhosttyFocusOutcomeMapper> {
    const { sessionTty } = params
    this.macOsTtyFocusCalls.push({ sessionTty })

    return Promise.resolve(this.macOsGhosttyTtyFocusOutcome)
  }

  protected override _focusVsCodeWindow(params: { bundlePath: string; cwd: string }): Promise<void> {
    const { bundlePath, cwd } = params
    this.macOsWindowFocusCalls.push({ bundlePath, cwd })

    if (!this.isMacOsWindowFocusStubbed) {
      return super._focusVsCodeWindow(params)
    }

    return Promise.resolve()
  }

  protected override _installLinuxFocusTool(): Promise<void> {
    this.linuxFocusToolInstallAttemptCount += 1

    if (this.linuxFocusToolInstallError !== undefined) {
      return Promise.reject(this.linuxFocusToolInstallError)
    }

    return Promise.resolve()
  }

  protected override _isLinuxFocusToolInstalled(): Promise<boolean> {
    if (this.isLinuxFocusToolInstalled === undefined) {
      return super._isLinuxFocusToolInstalled()
    }

    return Promise.resolve(this.isLinuxFocusToolInstalled)
  }
}
