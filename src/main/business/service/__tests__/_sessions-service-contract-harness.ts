import { GhosttyFocusOutcomeMapper } from '#src/main/business/enum/ghostty-focus-outcome-mapper-enum'
import { type GhosttyFocusPeer, _SessionsService } from '#src/main/business/service/sessions-service-singleton'
import { type OS } from '#src/shared/business/enum/os-enum'

export class SessionsServiceContractHarness extends _SessionsService {
  isLinuxFocusToolInstalled: boolean | undefined
  isMacOsGhosttyPeersStubbed = true
  isMacOsGhosttySessionTtyStubbed = true
  isMacOsWindowFocusStubbed = true
  linuxFocusToolInstallAttemptCount = 0
  linuxFocusToolInstallError: Error | undefined
  macOsAgentsQueryStdout: string | undefined
  macOsGhosttyFocusPeers: GhosttyFocusPeer[] = []
  macOsGhosttySessionTty: string | undefined
  macOsGhosttyTabFocusOutcome: GhosttyFocusOutcomeMapper = GhosttyFocusOutcomeMapper.FOCUSED
  macOsGhosttyTtyFocusOutcome: GhosttyFocusOutcomeMapper = GhosttyFocusOutcomeMapper.MISSING
  macOsGhosttyTtySupport = false
  readonly macOsBundleActivateCalls: { bundlePath: string }[] = []
  readonly macOsBundleResolveCalls: { hopCount: number; pid: number }[] = []
  readonly macOsTabFocusCalls: { cwd: string; matchRank: number }[] = []
  readonly macOsTtyFocusCalls: { sessionTty: string }[] = []
  readonly macOsWindowFocusCalls: { bundlePath: string; cwd: string }[] = []
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

  protected override async _runAgentsQuery(): Promise<string> {
    if (this.macOsAgentsQueryStdout === undefined) {
      return super._runAgentsQuery()
    }

    return this.macOsAgentsQueryStdout
  }

  protected override _resolveGhosttyTtySupport(): Promise<boolean> {
    return Promise.resolve(this.macOsGhosttyTtySupport)
  }

  protected override async _resolveSessionTty(params: { pid: number }): Promise<string | undefined> {
    if (!this.isMacOsGhosttySessionTtyStubbed) {
      return super._resolveSessionTty(params)
    }

    return this.macOsGhosttySessionTty
  }

  protected override async _listGhosttyFocusPeers(params: { cwd: string; pid: number }): Promise<GhosttyFocusPeer[]> {
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

  protected override _resolveAppBundlePath(params: { hopCount: number; pid: number }): Promise<string> {
    const { hopCount, pid } = params
    this.macOsBundleResolveCalls.push({ hopCount, pid })

    return Promise.resolve(this._macOsBundlePath)
  }
}
