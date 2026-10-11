// Supplements: ./claude-system-access-token-service.contract.yaml
// Covers what contract.yaml cannot express:
// - the async rejections of resolveAccessToken: the Linux missing-file, missing-token and
//   invalid-JSON failures plus the windows unsupported-platform dispatch (the contract
//   runner's error strategy catches synchronous throws only)
// - the Linux happy path through the real filesystem: a temp home fixture with a
//   .claude/.credentials.json file (contract terms cannot stage files)
// - the macOS Keychain read path: the retry budget, the exhausted-retries wrapping and the
//   timeout-kill error message, driven through a subclass stubbing the single security
//   exec and the retry delay (contract terms cannot stub protected async collaborators)
// - refreshAccessToken: the claude CLI refresh runs before the keychain re-read, and a CLI
//   refresh failure surfaces without any keychain read

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { ClaudeSystemAccessTokenService } from '#src/main/business/service/claude-system-access-token-service'
import { OS } from '#src/shared/business/enum/os-enum'

const createLinuxHomeFixture = async (params: { credentialsJson?: string }) => {
  const { credentialsJson } = params
  const homeDir = await mkdtemp(join(tmpdir(), 'usage-pulse-token-home-'))
  const claudeDir = join(homeDir, '.claude')

  await mkdir(claudeDir, { recursive: true })

  if (credentialsJson !== undefined) {
    await writeFile(join(claudeDir, '.credentials.json'), `${credentialsJson}\n`, 'utf8')
  }

  return {
    cleanup: async () => {
      await rm(homeDir, { force: true, recursive: true })
    },
    credentialsPath: join(claudeDir, '.credentials.json'),
    homeDir,
  }
}

class KeychainReadStubService extends ClaudeSystemAccessTokenService {
  readAttemptsCount = 0
  readOutcomes: Array<Error | string> = []

  constructor(params: { readOutcomes: Array<Error | string> }) {
    super({ homeDir: '/tmp/unused-claude-home', platform: OS.MACOS })
    this.readOutcomes = [...params.readOutcomes]
  }

  protected async _readKeychainCredentialsJsonOnce(): Promise<string> {
    this.readAttemptsCount += 1
    const outcome = this.readOutcomes.shift()

    if (outcome === undefined) {
      throw new Error('unexpected keychain read attempt')
    }

    if (typeof outcome === 'string') {
      return outcome
    }

    throw outcome
  }

  protected async _waitForKeychainRetryDelay(): Promise<void> {
    return await Promise.resolve()
  }
}

class CliTokenRefreshStubService extends KeychainReadStubService {
  cliRefreshCallsCount = 0
  cliRefreshError: Error | undefined
  lastCliRefreshCommand = ''

  constructor(params: { cliRefreshError?: Error; readOutcomes: Array<Error | string> }) {
    super({ readOutcomes: params.readOutcomes })
    this.cliRefreshError = params.cliRefreshError
  }

  protected async _runCliTokenRefresh(params: { command: string }): Promise<void> {
    const { command } = params
    this.cliRefreshCallsCount += 1
    this.lastCliRefreshCommand = command

    if (this.cliRefreshError !== undefined) {
      throw this.cliRefreshError
    }

    return await Promise.resolve()
  }
}

describe('ClaudeSystemAccessTokenService [contract supplement]', () => {
  it('resolves the trimmed claudeAiOauth accessToken and ignores the mcpOAuth section', async () => {
    const fixture = await createLinuxHomeFixture({
      credentialsJson:
        '{"claudeAiOauth":{"accessToken":"  satp-aiOauth-token-123  "},"mcpOAuth":{"my-server":{"access_token":"mcp-token-to-ignore"}}}',
    })

    try {
      const service = new ClaudeSystemAccessTokenService({ homeDir: fixture.homeDir, platform: OS.LINUX })

      await expect(service.resolveAccessToken()).resolves.toBe('satp-aiOauth-token-123')
    } finally {
      await fixture.cleanup()
    }
  })

  it('rejects with the read-failure message naming the missing credentials file', async () => {
    const fixture = await createLinuxHomeFixture({})

    try {
      const service = new ClaudeSystemAccessTokenService({ homeDir: fixture.homeDir, platform: OS.LINUX })

      await expect(service.resolveAccessToken()).rejects.toThrow(
        `reading the Claude Code credentials file '${fixture.credentialsPath}' failed:`,
      )
    } finally {
      await fixture.cleanup()
    }
  })

  it('rejects with the missing-accessToken message when claudeAiOauth has no accessToken', async () => {
    const fixture = await createLinuxHomeFixture({ credentialsJson: '{"claudeAiOauth":{}}' })

    try {
      const service = new ClaudeSystemAccessTokenService({ homeDir: fixture.homeDir, platform: OS.LINUX })

      await expect(service.resolveAccessToken()).rejects.toThrow(
        `${fixture.credentialsPath} is missing a usable claudeAiOauth.accessToken`,
      )
    } finally {
      await fixture.cleanup()
    }
  })

  it('rejects with the missing-accessToken message when the accessToken is empty', async () => {
    const fixture = await createLinuxHomeFixture({ credentialsJson: '{"claudeAiOauth":{"accessToken":""}}' })

    try {
      const service = new ClaudeSystemAccessTokenService({ homeDir: fixture.homeDir, platform: OS.LINUX })

      await expect(service.resolveAccessToken()).rejects.toThrow(
        `${fixture.credentialsPath} is missing a usable claudeAiOauth.accessToken`,
      )
    } finally {
      await fixture.cleanup()
    }
  })

  it('rejects with the not-valid-JSON message for malformed credentials content', async () => {
    const fixture = await createLinuxHomeFixture({ credentialsJson: 'definitely not json' })

    try {
      const service = new ClaudeSystemAccessTokenService({ homeDir: fixture.homeDir, platform: OS.LINUX })

      await expect(service.resolveAccessToken()).rejects.toThrow(`${fixture.credentialsPath} is not valid JSON`)
    } finally {
      await fixture.cleanup()
    }
  })

  it('rejects with the not-a-JSON-object message when the credentials content is null', async () => {
    const fixture = await createLinuxHomeFixture({ credentialsJson: 'null' })

    try {
      const service = new ClaudeSystemAccessTokenService({ homeDir: fixture.homeDir, platform: OS.LINUX })

      await expect(service.resolveAccessToken()).rejects.toThrow(`${fixture.credentialsPath} is not a JSON object`)
    } finally {
      await fixture.cleanup()
    }
  })

  it('rejects the windows platform with the unsupported-platform message', async () => {
    const service = new ClaudeSystemAccessTokenService({ homeDir: '/tmp/unused-claude-home', platform: OS.WINDOWS })

    await expect(service.resolveAccessToken()).rejects.toThrow(
      "Reading the Claude token from the system is not supported on 'WINDOWS'",
    )
  })

  it('rejects the macos keychain read with the wrapped failure message after exhausting all attempts', async () => {
    const readFailure = Object.assign(new Error('Command failed: security find-generic-password'), {
      stderr: 'security: SecKeychainSearchCopyNext: intermittent keychain error',
    })
    const service = new KeychainReadStubService({ readOutcomes: [readFailure, readFailure, readFailure] })

    await expect(service.resolveAccessToken()).rejects.toThrow(
      "reading 'Claude Code-credentials' from the macOS Keychain failed: security: SecKeychainSearchCopyNext: intermittent keychain error",
    )
    expect(service.readAttemptsCount).toBe(3)
  })

  it('resolves the token after transient keychain read failures within the retry budget', async () => {
    const timeoutKill = Object.assign(new Error('Command failed: security find-generic-password'), { killed: true })
    const readFailure = Object.assign(new Error('Command failed: security find-generic-password'), {
      stderr: 'security: SecKeychainSearchCopyNext: intermittent keychain error',
    })
    const service = new KeychainReadStubService({
      readOutcomes: [timeoutKill, readFailure, '{"claudeAiOauth":{"accessToken":"satp-keychain-token"}}'],
    })

    await expect(service.resolveAccessToken()).resolves.toBe('satp-keychain-token')
    expect(service.readAttemptsCount).toBe(3)
  })

  it('reports the timeout kill as the keychain failure reason when stderr is empty', async () => {
    const timeoutKill = Object.assign(new Error('Command failed: security find-generic-password'), { killed: true })
    const service = new KeychainReadStubService({ readOutcomes: [timeoutKill, timeoutKill, timeoutKill] })

    await expect(service.resolveAccessToken()).rejects.toThrow(
      "reading 'Claude Code-credentials' from the macOS Keychain failed: the 'security' command timed out; the login keychain may be locked",
    )
    expect(service.readAttemptsCount).toBe(3)
  })

  it('refreshes the token by running the given claude CLI command before re-reading the keychain', async () => {
    const service = new CliTokenRefreshStubService({
      readOutcomes: ['{"claudeAiOauth":{"accessToken":"satp-refreshed-token"}}'],
    })

    await expect(
      service.refreshAccessToken({ command: 'claude -p "what is your name, only name" --model haiku' }),
    ).resolves.toBe('satp-refreshed-token')
    expect(service.cliRefreshCallsCount).toBe(1)
    expect(service.lastCliRefreshCommand).toBe('claude -p "what is your name, only name" --model haiku')
  })

  it('rejects with the CLI refresh failure without reading the keychain', async () => {
    const service = new CliTokenRefreshStubService({
      cliRefreshError: new Error('refreshing the Claude token via the claude CLI failed: not logged in'),
      readOutcomes: [],
    })

    await expect(service.refreshAccessToken({ command: 'claude -p ping --model haiku' })).rejects.toThrow(
      'refreshing the Claude token via the claude CLI failed: not logged in',
    )
    expect(service.cliRefreshCallsCount).toBe(1)
  })
})
