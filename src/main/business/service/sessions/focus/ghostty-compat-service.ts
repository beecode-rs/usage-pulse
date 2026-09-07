import { SessionsOsascriptService } from '#src/main/business/service/sessions/osascript-service'

const GHOSTTY_BUNDLE_ID = 'com.mitchellh.ghostty'

const GHOSTTY_TTY_SUPPORT_PROBE_SCRIPT = `tell application id "${GHOSTTY_BUNDLE_ID}"
  count of (tty of every terminal)
end tell`

export class SessionsFocusGhosttyCompatService {
  protected readonly _osascriptService = new SessionsOsascriptService()

  async isTtySupported(): Promise<boolean> {
    try {
      await this._osascriptService.runOsascript({ args: [], script: GHOSTTY_TTY_SUPPORT_PROBE_SCRIPT })

      return true
    } catch {
      return false
    }
  }
}
