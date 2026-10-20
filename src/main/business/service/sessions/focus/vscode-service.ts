import { SessionsClaudeQueryService } from '#src/main/business/service/sessions/claude-query-service'
import { SessionsOsascriptService } from '#src/main/business/service/sessions/osascript-service'
import { constant } from '#src/main/util/constant'

export class SessionsFocusVsCodeService {
  protected readonly _claudeQueryService = new SessionsClaudeQueryService()
  protected readonly _osascriptService = new SessionsOsascriptService()

  async focusWindow(params: { bundlePath: string; cwd: string }): Promise<void> {
    const { bundlePath, cwd } = params
    const windowTitles = await this._listWindowTitles({ bundlePath })
    const windowIndex = this._resolveWindowIndex({ cwd, windowTitles })

    if (windowIndex === undefined) {
      return
    }

    await this._raiseWindow({ bundlePath, windowIndex })
  }

  protected async _listWindowTitles(params: { bundlePath: string }): Promise<string[]> {
    const { bundlePath } = params
    try {
      const stdout = await this._osascriptService.runOsascript({
        args: [bundlePath],
        script: constant.sessions.focus.vscode.windowTitlesScript,
      })

      return this._parseWindowTitles({ stdout })
    } catch (error) {
      const deniedMessage = this._resolvePermissionDeniedMessage({ error })

      if (deniedMessage !== undefined) {
        throw new Error(deniedMessage)
      }

      throw new Error(
        `listing the VS Code windows failed: ${this._claudeQueryService.resolveQueryErrorMessage({ error })}`,
      )
    }
  }

  protected _parseWindowTitles(params: { stdout: string }): string[] {
    const { stdout } = params

    return stdout
      .trim()
      .split('\n')
      .filter((line) => {
        return line !== ''
      })
  }

  protected _resolveWindowIndex(params: { cwd: string; windowTitles: string[] }): number | undefined {
    const { cwd, windowTitles } = params
    const workspaceNames = this._resolveWorkspaceNameCandidates({ cwd })
    const firstMatchedPosition = workspaceNames
      .map((workspaceName) => {
        return windowTitles.findIndex((windowTitle) => {
          return this._resolveWorkspaceName({ windowTitle }) === workspaceName
        })
      })
      .find((windowPosition) => {
        return windowPosition !== -1
      })

    if (firstMatchedPosition === undefined) {
      return undefined
    }

    return firstMatchedPosition + 1
  }

  protected _resolveWorkspaceName(params: { windowTitle: string }): string {
    const { windowTitle } = params
    const titleParts = windowTitle.split(constant.sessions.focus.vscode.titleSeparator)
    const lastTitlePart = titleParts[titleParts.length - 1]

    if (lastTitlePart === undefined) {
      return windowTitle
    }

    return lastTitlePart
  }

  protected _resolveWorkspaceNameCandidates(params: { cwd: string }): string[] {
    const { cwd } = params

    return cwd
      .split('/')
      .filter((pathPart) => {
        return pathPart !== ''
      })
      .slice(-constant.sessions.focus.vscode.workspaceNameCandidateLimit)
      .reverse()
  }

  protected async _raiseWindow(params: { bundlePath: string; windowIndex: number }): Promise<void> {
    const { bundlePath, windowIndex } = params
    try {
      await this._osascriptService.runOsascript({
        args: [bundlePath, String(windowIndex)],
        script: constant.sessions.focus.vscode.windowRaiseScript,
      })
    } catch (error) {
      const deniedMessage = this._resolvePermissionDeniedMessage({ error })

      if (deniedMessage !== undefined) {
        throw new Error(deniedMessage)
      }

      throw new Error(
        `raising the VS Code window failed: ${this._claudeQueryService.resolveQueryErrorMessage({ error })}`,
      )
    }
  }

  protected _resolvePermissionDeniedMessage(params: { error: unknown }): string | undefined {
    const { error } = params
    if (this._osascriptService.isAutomationDenied({ error })) {
      return constant.sessions.focus.vscode.systemEventsDeniedMessage
    }

    if (this._osascriptService.isAssistiveAccessDenied({ error })) {
      return constant.sessions.focus.vscode.accessibilityDeniedMessage
    }

    return undefined
  }
}
