import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { SessionsClaudeQueryService } from '#src/main/business/service/sessions/claude-query-service'

const execFileAsync = promisify(execFile)

const OSASCRIPT_TIMEOUT_MS = 5_000

export class SessionsOsascriptService {
  protected readonly _claudeQueryService = new SessionsClaudeQueryService()

  async runOsascript(params: { args: string[]; script: string }): Promise<string> {
    const { args, script } = params
    const { stdout } = await execFileAsync('osascript', ['-e', script, '--', ...args], {
      timeout: OSASCRIPT_TIMEOUT_MS,
    })

    return stdout
  }

  isAutomationDenied(params: { error: unknown }): boolean {
    const { error } = params
    const message = this._claudeQueryService.resolveQueryErrorMessage({ error })

    return message.includes('Not authorized') || message.includes('-1743')
  }

  isAssistiveAccessDenied(params: { error: unknown }): boolean {
    const { error } = params
    const message = this._claudeQueryService.resolveQueryErrorMessage({ error })

    return message.includes('assistive access')
  }
}
