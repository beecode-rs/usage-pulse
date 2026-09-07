import { execFile } from 'node:child_process'
import { basename } from 'node:path'
import { promisify } from 'node:util'

import { errorUtil } from '#src/main/util/error-util'

const execFileAsync = promisify(execFile)

const OPEN_APP_TIMEOUT_MS = 5_000

const VSCODE_BUNDLE_BASENAME = 'Visual Studio Code.app'

export class SessionsFocusMacOsService {
  async activateAppBundle(params: { bundlePath: string }): Promise<void> {
    const { bundlePath } = params
    try {
      await execFileAsync('open', ['-a', bundlePath], { timeout: OPEN_APP_TIMEOUT_MS })
    } catch (error) {
      throw new Error(`activating '${bundlePath}' failed: ${errorUtil.resolveMessage(error)}`)
    }
  }

  isGhosttyBundle(params: { bundlePath: string }): boolean {
    const { bundlePath } = params

    return basename(bundlePath) === 'Ghostty.app'
  }

  isVsCodeBundle(params: { bundlePath: string }): boolean {
    const { bundlePath } = params

    return basename(bundlePath) === VSCODE_BUNDLE_BASENAME
  }
}
