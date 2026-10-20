import { execFile } from 'node:child_process'
import { basename } from 'node:path'
import { promisify } from 'node:util'

import { constant } from '#src/main/util/constant'
import { errorUtil } from '#src/shared/util/error-util'

const execFileAsync = promisify(execFile)

export class SessionsFocusMacOsService {
  async activateAppBundle(params: { bundlePath: string }): Promise<void> {
    const { bundlePath } = params
    try {
      await execFileAsync('open', ['-a', bundlePath], { timeout: constant.sessions.focus.macOs.openAppTimeoutMs })
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

    return basename(bundlePath) === constant.sessions.focus.vscode.bundleBasename
  }
}
