// Supplements: ./claude-system-token-service.contract.yaml
// Covers what contract.yaml cannot express:
// - the async rejections of resolveAccessToken: the Linux missing-file, missing-token and
//   invalid-JSON failures plus the windows unsupported-platform dispatch (the contract
//   runner's error strategy catches synchronous throws only)
// - the Linux happy path through the real filesystem: a temp home fixture with a
//   .claude/.credentials.json file (contract terms cannot stage files)
// - the macos platform routing into the macOS Keychain exec, which on non-macOS machines
//   rejects with the wrapped keychain read error

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { ClaudeSystemTokenService } from '#src/main/business/service/claude-system-token-service'
import { OS, osUtil } from '#src/main/util/os-util'

const createLinuxHomeFixture = async (params: { credentialsJson?: string }) => {
  const homeDir = await mkdtemp(join(tmpdir(), 'usage-pulse-token-home-'))
  const claudeDir = join(homeDir, '.claude')

  await mkdir(claudeDir, { recursive: true })

  if (params.credentialsJson !== undefined) {
    await writeFile(join(claudeDir, '.credentials.json'), `${params.credentialsJson}\n`, 'utf8')
  }

  return {
    cleanup: async () => {
      await rm(homeDir, { force: true, recursive: true })
    },
    credentialsPath: join(claudeDir, '.credentials.json'),
    homeDir,
  }
}

describe('ClaudeSystemTokenService [contract supplement]', () => {
  it('resolves the trimmed claudeAiOauth accessToken and ignores the mcpOAuth section', async () => {
    const fixture = await createLinuxHomeFixture({
      credentialsJson:
        '{"claudeAiOauth":{"accessToken":"  satp-aiOauth-token-123  "},"mcpOAuth":{"my-server":{"access_token":"mcp-token-to-ignore"}}}',
    })

    try {
      const service = new ClaudeSystemTokenService({ homeDir: fixture.homeDir, platform: OS.LINUX })

      await expect(service.resolveAccessToken()).resolves.toBe('satp-aiOauth-token-123')
    } finally {
      await fixture.cleanup()
    }
  })

  it('rejects with the read-failure message naming the missing credentials file', async () => {
    const fixture = await createLinuxHomeFixture({})

    try {
      const service = new ClaudeSystemTokenService({ homeDir: fixture.homeDir, platform: OS.LINUX })

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
      const service = new ClaudeSystemTokenService({ homeDir: fixture.homeDir, platform: OS.LINUX })

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
      const service = new ClaudeSystemTokenService({ homeDir: fixture.homeDir, platform: OS.LINUX })

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
      const service = new ClaudeSystemTokenService({ homeDir: fixture.homeDir, platform: OS.LINUX })

      await expect(service.resolveAccessToken()).rejects.toThrow(`${fixture.credentialsPath} is not valid JSON`)
    } finally {
      await fixture.cleanup()
    }
  })

  it('rejects with the not-a-JSON-object message when the credentials content is null', async () => {
    const fixture = await createLinuxHomeFixture({ credentialsJson: 'null' })

    try {
      const service = new ClaudeSystemTokenService({ homeDir: fixture.homeDir, platform: OS.LINUX })

      await expect(service.resolveAccessToken()).rejects.toThrow(`${fixture.credentialsPath} is not a JSON object`)
    } finally {
      await fixture.cleanup()
    }
  })

  it('rejects the windows platform with the unsupported-platform message', async () => {
    const service = new ClaudeSystemTokenService({ homeDir: '/tmp/unused-claude-home', platform: OS.WINDOWS })

    await expect(service.resolveAccessToken()).rejects.toThrow(
      "Reading the Claude token from the system is not supported on 'WINDOWS'",
    )
  })

  it.skipIf(osUtil.resolvePlatform() === OS.MACOS)(
    'rejects the macos platform with the keychain read-failure message when the security binary is unavailable',
    async () => {
      const service = new ClaudeSystemTokenService({ homeDir: '/tmp/unused-claude-home', platform: OS.MACOS })

      await expect(service.resolveAccessToken()).rejects.toThrow(
        "reading 'Claude Code-credentials' from the macOS Keychain failed:",
      )
    },
  )
})
