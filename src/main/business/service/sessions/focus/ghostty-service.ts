import { GhosttyFocusOutcomeMapper } from '#src/main/business/enum/ghostty-focus-outcome-mapper-enum'
import { SessionsClaudeQueryService } from '#src/main/business/service/sessions/claude-query-service'
import { SessionsOsascriptService } from '#src/main/business/service/sessions/osascript-service'
import { constant } from '#src/main/util/constant'

export type SessionsFocusGhosttyPeer = {
  hostPid: number
  hostStartedAtMs: number | undefined
  pid: number
}

export class SessionsFocusGhosttyService {
  protected readonly _claudeQueryService = new SessionsClaudeQueryService()
  protected readonly _osascriptService = new SessionsOsascriptService()

  focusGhosttyTab(params: { cwd: string; matchRank: number }): Promise<string> {
    const { cwd, matchRank } = params

    return this._osascriptService.runOsascript({
      args: [cwd, String(matchRank)],
      script: constant.sessions.focus.ghostty.tabFocusScript,
    })
  }

  focusGhosttyTerminalByTty(params: { sessionTty: string }): Promise<string> {
    const { sessionTty } = params

    return this._osascriptService.runOsascript({
      args: [sessionTty],
      script: constant.sessions.focus.ghostty.ttyFocusScript,
    })
  }

  parseGhosttyFocusOutcome(params: { stdout: string }): GhosttyFocusOutcomeMapper {
    const { stdout } = params
    const outcome = stdout.trim()

    switch (outcome) {
      case GhosttyFocusOutcomeMapper.FOCUSED: {
        return GhosttyFocusOutcomeMapper.FOCUSED
      }

      case GhosttyFocusOutcomeMapper.HIDDEN: {
        return GhosttyFocusOutcomeMapper.HIDDEN
      }

      case GhosttyFocusOutcomeMapper.MISSING: {
        return GhosttyFocusOutcomeMapper.MISSING
      }

      default: {
        throw new Error(`the Ghostty focus script printed unexpected output: '${outcome}'`)
      }
    }
  }

  resolveFocusErrorMessage(params: { error: unknown }): string {
    const { error } = params
    if (this._osascriptService.isAutomationDenied({ error })) {
      return constant.sessions.focus.ghostty.automationDeniedMessage
    }

    return `focusing the Ghostty tab failed: ${this._claudeQueryService.resolveQueryErrorMessage({ error })}`
  }

  resolvePeerRank(params: { peers: SessionsFocusGhosttyPeer[]; pid: number }): number {
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

  protected _resolvePeerStartMs(peer: SessionsFocusGhosttyPeer): number {
    if (peer.hostStartedAtMs === undefined) {
      return Number.MAX_SAFE_INTEGER
    }

    return peer.hostStartedAtMs
  }
}
