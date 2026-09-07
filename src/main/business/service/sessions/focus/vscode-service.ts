import { SessionsClaudeQueryService } from '#src/main/business/service/sessions/claude-query-service'
import { SessionsOsascriptService } from '#src/main/business/service/sessions/osascript-service'

const MAX_VSCODE_WORKSPACE_NAME_CANDIDATES = 3

const VSCODE_ACCESSIBILITY_DENIED_MESSAGE =
  'to focus the exact VS Code window, allow this app to control your computer in System Settings > Privacy & Security > Accessibility'

const VSCODE_SYSTEM_EVENTS_DENIED_MESSAGE =
  'to focus the exact VS Code window, allow this app to control System Events in System Settings > Privacy & Security > Automation'

const VSCODE_TITLE_SEPARATOR = ' — '

const VSCODE_WINDOW_RAISE_SCRIPT = `on run argv
  set appBundlePath to item 1 of argv
  set windowIndex to item 2 of argv as integer
  set appId to id of application appBundlePath
  tell application "System Events"
    tell (first application process whose bundle identifier is appId)
      set frontmost to true
      perform action "AXRaise" of window windowIndex
    end tell
  end tell
end run`

const VSCODE_WINDOW_TITLES_SCRIPT = `on run argv
  set appBundlePath to item 1 of argv
  set appId to id of application appBundlePath
  tell application "System Events"
    tell (first application process whose bundle identifier is appId)
      set originalDelimiters to AppleScript's text item delimiters
      set AppleScript's text item delimiters to linefeed
      set windowNames to (name of every window) as text
      set AppleScript's text item delimiters to originalDelimiters
      return windowNames
    end tell
  end tell
end run`

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
        script: VSCODE_WINDOW_TITLES_SCRIPT,
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
    const titleParts = windowTitle.split(VSCODE_TITLE_SEPARATOR)
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
      .slice(-MAX_VSCODE_WORKSPACE_NAME_CANDIDATES)
      .reverse()
  }

  protected async _raiseWindow(params: { bundlePath: string; windowIndex: number }): Promise<void> {
    const { bundlePath, windowIndex } = params
    try {
      await this._osascriptService.runOsascript({
        args: [bundlePath, String(windowIndex)],
        script: VSCODE_WINDOW_RAISE_SCRIPT,
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
      return VSCODE_SYSTEM_EVENTS_DENIED_MESSAGE
    }

    if (this._osascriptService.isAssistiveAccessDenied({ error })) {
      return VSCODE_ACCESSIBILITY_DENIED_MESSAGE
    }

    return undefined
  }
}
