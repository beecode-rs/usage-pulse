import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { promisify } from 'node:util'

import { errorUtil } from '#src/main/util/error-util'
import { rawEnvUtil } from '#src/main/util/raw-env-util'

const execFileAsync = promisify(execFile)

const SESSIONS_QUERY_TIMEOUT_MS = 10_000

export class SessionsClaudeQueryService {
  async runAgentsQuery(): Promise<string> {
    try {
      const { stdout } = await execFileAsync('claude', ['agents', '--json'], {
        env: this._resolveQueryEnv(),
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

  protected _resolveQueryEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...rawEnvUtil.processEnv }

    env.PATH = `${homedir()}/.local/bin:${env.PATH ?? ''}`

    return env
  }
}
