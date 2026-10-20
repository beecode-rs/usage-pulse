import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { processEnvWithUserLocalBinPath } from '#src/main/util/config'
import { constant } from '#src/main/util/constant'
import { errorUtil } from '#src/shared/util/error-util'

const execFileAsync = promisify(execFile)

export class SessionsClaudeQueryService {
  async runAgentsQuery(): Promise<string> {
    try {
      const { stdout } = await execFileAsync('claude', ['agents', '--json'], {
        env: processEnvWithUserLocalBinPath(),
        timeout: constant.sessions.claudeQuery.timeoutMs,
      })

      return stdout
    } catch (error) {
      throw new Error(`running 'claude agents --json' failed: ${this.resolveQueryErrorMessage({ error })}`)
    }
  }

  resolveQueryErrorMessage(params: { error: unknown }): string {
    const { error } = params
    const stderr = (error as { stderr?: unknown }).stderr

    if (typeof stderr === 'string' && stderr.trim() !== '') {
      return stderr.trim()
    }

    return errorUtil.resolveMessage(error)
  }
}
