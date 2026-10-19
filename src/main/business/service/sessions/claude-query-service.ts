import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { processEnvWithUserLocalBinPath } from '#src/main/util/config'
import { errorUtil } from '#src/main/util/error-util'

const execFileAsync = promisify(execFile)

const SESSIONS_QUERY_TIMEOUT_MS = 10_000

export class SessionsClaudeQueryService {
  async runAgentsQuery(): Promise<string> {
    try {
      const { stdout } = await execFileAsync('claude', ['agents', '--json'], {
        env: processEnvWithUserLocalBinPath(),
        timeout: SESSIONS_QUERY_TIMEOUT_MS,
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
