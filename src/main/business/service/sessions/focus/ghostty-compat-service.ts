import { SessionsOsascriptService } from '#src/main/business/service/sessions/osascript-service'
import { constant } from '#src/main/util/constant'

export class SessionsFocusGhosttyCompatService {
  protected readonly _osascriptService = new SessionsOsascriptService()

  async isTtySupported(): Promise<boolean> {
    try {
      await this._osascriptService.runOsascript({
        args: [],
        script: constant.sessions.focus.ghostty.ttySupportProbeScript,
      })

      return true
    } catch {
      return false
    }
  }
}
