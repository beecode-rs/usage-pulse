import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { TriggerCommandService } from '#src/main/business/service/trigger-command-service'
import { errorUtil } from '#src/main/util/error-util'
import { objectUtil } from '#src/main/util/object-util'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'
import { constant } from '#src/shared/util/constant'

const execFileAsync = promisify(execFile)

export class ClaudeSystemAccessTokenService {
  protected readonly _homeDir: string
  protected readonly _keychainSourceName = "'Claude Code-credentials' keychain entry"
  protected readonly _platform: OS

  constructor(params: { homeDir: string; platform: OS } = { homeDir: homedir(), platform: osUtil.resolvePlatform() }) {
    const { homeDir, platform } = params
    this._homeDir = homeDir
    this._platform = platform
  }

  async resolveAccessToken(): Promise<string> {
    switch (this._platform) {
      case OS.LINUX: {
        const credentialsJson = await this._readLinuxCredentialsJson()

        return this._extractAccessToken({ credentialsJson, sourceName: this._resolveLinuxCredentialsPath() })
      }

      case OS.MACOS: {
        const credentialsJson = await this._readKeychainCredentialsJson()

        return this._extractAccessToken({ credentialsJson, sourceName: this._keychainSourceName })
      }

      default: {
        throw new Error(`Reading the Claude token from the system is not supported on '${this._platform}'`)
      }
    }
  }

  async refreshAccessToken(params: { command: string }): Promise<string> {
    const { command } = params

    await this._runCliTokenRefresh({ command })

    return await this.resolveAccessToken()
  }

  protected async _runCliTokenRefresh(params: { command: string }): Promise<void> {
    const { command } = params
    const { timeoutMs } = constant.claudeSystemAccessToken.cliTokenRefresh
    const result = await new TriggerCommandService().run({ command, timeoutMs })

    if (result.isTimedOut) {
      throw new Error(`refreshing the Claude token via the claude CLI timed out after ${String(timeoutMs)}ms`)
    }

    if (result.exitCode !== 0) {
      throw new Error(`refreshing the Claude token via the claude CLI failed: ${result.output}`)
    }
  }

  protected _extractAccessToken(params: { credentialsJson: string; sourceName: string }): string {
    const { credentialsJson, sourceName } = params
    const credentialsRecord = this._parseCredentialsRecord({
      credentialsJson,
      sourceName,
    })
    const oauthRecord = objectUtil.asRecord(credentialsRecord['claudeAiOauth'])
    const accessToken = oauthRecord?.['accessToken']

    if (typeof accessToken === 'string' && accessToken.trim() !== '') {
      return accessToken.trim()
    }

    throw new Error(`${sourceName} is missing a usable claudeAiOauth.accessToken`)
  }

  protected _parseCredentialsRecord(params: { credentialsJson: string; sourceName: string }): Record<string, unknown> {
    const { credentialsJson, sourceName } = params
    const parsedValue = this._parseCredentialsValue({
      credentialsJson,
      sourceName,
    })
    const parsedRecord = objectUtil.asRecord(parsedValue)

    if (parsedRecord === undefined) {
      throw new Error(`${sourceName} is not a JSON object`)
    }

    return parsedRecord
  }

  protected _parseCredentialsValue(params: { credentialsJson: string; sourceName: string }): unknown {
    const { credentialsJson, sourceName } = params
    try {
      return JSON.parse(credentialsJson)
    } catch {
      throw new Error(`${sourceName} is not valid JSON`)
    }
  }

  protected async _readKeychainCredentialsJson(): Promise<string> {
    const { attemptsCount } = constant.claudeSystemAccessToken.keychainRead

    try {
      return await this._readKeychainCredentialsJsonWithRetry({ remainingRetryCount: attemptsCount - 1 })
    } catch (error) {
      throw new Error(
        `reading 'Claude Code-credentials' from the macOS Keychain failed: ${this._resolveKeychainErrorMessage(error)}`,
      )
    }
  }

  protected async _readKeychainCredentialsJsonWithRetry(params: { remainingRetryCount: number }): Promise<string> {
    const { remainingRetryCount } = params

    try {
      return await this._readKeychainCredentialsJsonOnce()
    } catch (error) {
      if (remainingRetryCount <= 0) {
        throw error
      }

      await this._waitForKeychainRetryDelay()

      return await this._readKeychainCredentialsJsonWithRetry({ remainingRetryCount: remainingRetryCount - 1 })
    }
  }

  protected async _readKeychainCredentialsJsonOnce(): Promise<string> {
    const { stdout } = await execFileAsync(
      'security',
      ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      { timeout: constant.claudeSystemAccessToken.keychainRead.timeoutMs },
    )

    return stdout.trim()
  }

  protected async _waitForKeychainRetryDelay(): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, constant.claudeSystemAccessToken.keychainRead.retryDelayMs)
    })
  }

  protected async _readLinuxCredentialsJson(): Promise<string> {
    const credentialsPath = this._resolveLinuxCredentialsPath()

    try {
      const credentialsJson = await readFile(credentialsPath, 'utf8')

      return credentialsJson.trim()
    } catch (error) {
      throw new Error(
        `reading the Claude Code credentials file '${credentialsPath}' failed: ${errorUtil.resolveMessage(error)}`,
      )
    }
  }

  protected _resolveKeychainErrorMessage(error: unknown): string {
    const stderr = (error as { stderr?: unknown }).stderr

    if (typeof stderr === 'string' && stderr.trim() !== '') {
      return stderr.trim()
    }

    if ((error as { killed?: unknown }).killed === true) {
      return "the 'security' command timed out; the login keychain may be locked"
    }

    return errorUtil.resolveMessage(error)
  }

  protected _resolveLinuxCredentialsPath(): string {
    return join(this._homeDir, '.claude', '.credentials.json')
  }
}
