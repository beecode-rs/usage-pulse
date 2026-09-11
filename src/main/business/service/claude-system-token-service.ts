import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { errorUtil } from '#src/main/util/error-util'
import { objectUtil } from '#src/main/util/object-util'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'

const execFileAsync = promisify(execFile)

export class ClaudeSystemTokenService {
  protected readonly _homeDir: string
  protected readonly _keychainSourceName = "'Claude Code-credentials' keychain entry"
  protected readonly _platform: OS

  constructor(params: { homeDir?: string; platform?: OS } = {}) {
    this._homeDir = params.homeDir ?? homedir()
    this._platform = params.platform ?? osUtil.resolvePlatform()
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

  protected _extractAccessToken(params: { credentialsJson: string; sourceName: string }): string {
    const credentialsRecord = this._parseCredentialsRecord({
      credentialsJson: params.credentialsJson,
      sourceName: params.sourceName,
    })
    const oauthRecord = objectUtil.asRecord(credentialsRecord['claudeAiOauth'])
    const accessToken = oauthRecord?.['accessToken']

    if (typeof accessToken === 'string' && accessToken.trim() !== '') {
      return accessToken.trim()
    }

    throw new Error(`${params.sourceName} is missing a usable claudeAiOauth.accessToken`)
  }

  protected _parseCredentialsRecord(params: { credentialsJson: string; sourceName: string }): Record<string, unknown> {
    const parsedValue = this._parseCredentialsValue({
      credentialsJson: params.credentialsJson,
      sourceName: params.sourceName,
    })
    const parsedRecord = objectUtil.asRecord(parsedValue)

    if (parsedRecord === undefined) {
      throw new Error(`${params.sourceName} is not a JSON object`)
    }

    return parsedRecord
  }

  protected _parseCredentialsValue(params: { credentialsJson: string; sourceName: string }): unknown {
    try {
      return JSON.parse(params.credentialsJson)
    } catch {
      throw new Error(`${params.sourceName} is not valid JSON`)
    }
  }

  protected async _readKeychainCredentialsJson(): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        'security',
        ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
        { timeout: 30000 },
      )

      return stdout.trim()
    } catch (error) {
      throw new Error(
        `reading 'Claude Code-credentials' from the macOS Keychain failed: ${this._resolveKeychainErrorMessage(error)}`,
      )
    }
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

    return errorUtil.resolveMessage(error)
  }

  protected _resolveLinuxCredentialsPath(): string {
    return join(this._homeDir, '.claude', '.credentials.json')
  }
}
