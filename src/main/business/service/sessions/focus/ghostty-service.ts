import { GhosttyFocusOutcomeMapper } from '#src/main/business/enum/ghostty-focus-outcome-mapper-enum'
import { SessionsClaudeQueryService } from '#src/main/business/service/sessions/claude-query-service'
import { SessionsOsascriptService } from '#src/main/business/service/sessions/osascript-service'

const GHOSTTY_BUNDLE_ID = 'com.mitchellh.ghostty'

const GHOSTTY_AUTOMATION_DENIED_MESSAGE =
  'to focus the exact Ghostty tab, allow this app to control Ghostty in System Settings > Privacy & Security > Automation'

const GHOSTTY_FRONT_WINDOW_POLL_COUNT = 20

const GHOSTTY_FRONT_WINDOW_POLL_DELAY_SECONDS = 0.1

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

export type GhosttyFocusPeer = {
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
      script: GHOSTTY_TAB_FOCUS_SCRIPT,
    })
  }

  focusGhosttyTerminalByTty(params: { sessionTty: string }): Promise<string> {
    const { sessionTty } = params

    return this._osascriptService.runOsascript({
      args: [sessionTty],
      script: GHOSTTY_TTY_FOCUS_SCRIPT,
    })
  }

  parseGhosttyFocusOutcome(params: { stdout: string }): GhosttyFocusOutcomeMapper {
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

  resolveFocusErrorMessage(params: { error: unknown }): string {
    const { error } = params
    if (this._osascriptService.isAutomationDenied({ error })) {
      return GHOSTTY_AUTOMATION_DENIED_MESSAGE
    }

    return `focusing the Ghostty tab failed: ${this._claudeQueryService.resolveQueryErrorMessage({ error })}`
  }

  resolvePeerRank(params: { peers: GhosttyFocusPeer[]; pid: number }): number {
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
}
