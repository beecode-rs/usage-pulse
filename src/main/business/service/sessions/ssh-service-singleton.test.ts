// Supplements: the per-host merge seams of _SessionsSshService._fetchHostResult
// that no contract yaml reaches: the claude and opencode ssh execs run through
// the real execFile path (a fake ssh binary prepended to PATH inspects its last
// argv element — the remote command — and answers the claude agents query or
// the opencode envelope), and the merged host result keeps the claude error
// semantics while the opencode sessions stay best-effort. Fresh service
// instances per test bypass the per-host result cache.

import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { _SessionsSshService } from '#src/main/business/service/sessions/ssh-service-singleton'
import { constant } from '#src/main/util/constant'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'
import { SessionProviderMapper } from '#src/shared/business/enum/session-provider-mapper-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'
import { type SshHostConfig } from '#src/shared/business/model/settings-model'

const fakeSshScript = `#!/bin/sh
for remoteCommand in "$@"; do :; done
case "$remoteCommand" in
  *"claude agents"*)
    if [ -n "$USAGE_PULSE_SSH_CLAUDE_FAILURE" ]; then
      printf '%s\\n' 'fake ssh: claude agents exec failed' >&2
      exit 1
    fi
    printf '%s\\n' '[{"cwd":"/remote","kind":"main","name":"claude-remote","pid":7,"sessionId":"cc-remote","startedAt":1,"status":"idle"}]'
    exit 0
    ;;
  *opencode*)
    if [ -n "$USAGE_PULSE_SSH_OPENCODE_FAILURE" ]; then
      printf '%s\\n' 'fake ssh: opencode exec failed' >&2
      exit 1
    fi
    printf '%s\\n' '{"data":[{"id":"ses_op_remote","location":{"directory":"/remote-op"},"model":{"id":"glm-5.3"},"time":{"created":2,"updated":3},"title":"opencode-remote","tokens":{"cache":{"read":0,"write":0},"input":10,"output":0,"reasoning":0}}]}'
    printf '\\n${constant.sessions.ssh.openCodeEnvelopeMarker}\\n'
    printf '%s\\n' '{"data":{"ses_op_remote":{"type":"running"}}}'
    printf '\\n${constant.sessions.ssh.openCodeEnvelopeMarker}\\n'
    printf '%s\\n' '{"cwd":{}}'
    printf '\\n${constant.sessions.ssh.openCodeEnvelopeMarker}\\n'
    printf '%s\\n' '[{"data":[]}]'
    printf '\\n${constant.sessions.ssh.openCodeEnvelopeMarker}\\n'
    printf '%s\\n' '[]'
    exit 0
    ;;
esac
exit 0
`

const sshHostFixture: SshHostConfig = {
  id: 'host-1',
  isEnabled: true,
  url: 'ssh://box',
}

const claudeFailureMessage = "connecting to 'ssh://box' failed: fake ssh: claude agents exec failed"

const resolveSessionIds = (sessions: SessionInfo[]): string[] => {
  return sessions.map((session) => {
    return session.sessionId
  })
}

const installSshShims = async () => {
  const binDir = await mkdtemp(join(tmpdir(), 'usage-pulse-ssh-bin-'))
  const originalPath = process.env.PATH
  const originalClaudeFailure = process.env.USAGE_PULSE_SSH_CLAUDE_FAILURE
  const originalOpencodeFailure = process.env.USAGE_PULSE_SSH_OPENCODE_FAILURE

  await writeFile(join(binDir, 'ssh'), fakeSshScript, 'utf8')
  await chmod(join(binDir, 'ssh'), 0o755)
  process.env.PATH = `${binDir}${delimiter}${originalPath}`
  delete process.env.USAGE_PULSE_SSH_CLAUDE_FAILURE
  delete process.env.USAGE_PULSE_SSH_OPENCODE_FAILURE

  return {
    restoreEnvironment: async () => {
      if (originalClaudeFailure === undefined) {
        delete process.env.USAGE_PULSE_SSH_CLAUDE_FAILURE
      } else {
        process.env.USAGE_PULSE_SSH_CLAUDE_FAILURE = originalClaudeFailure
      }

      if (originalOpencodeFailure === undefined) {
        delete process.env.USAGE_PULSE_SSH_OPENCODE_FAILURE
      } else {
        process.env.USAGE_PULSE_SSH_OPENCODE_FAILURE = originalOpencodeFailure
      }

      process.env.PATH = originalPath
      await rm(binDir, { force: true, recursive: true })
    },
    setClaudeFailure: () => {
      process.env.USAGE_PULSE_SSH_CLAUDE_FAILURE = 'true'
    },
    setOpencodeFailure: () => {
      process.env.USAGE_PULSE_SSH_OPENCODE_FAILURE = 'true'
    },
  }
}

const listMergedSessions = async (): Promise<{
  errorMessage: string | undefined
  sessions: SessionInfo[]
  unreachableHostCount: number
}> => {
  const service = new _SessionsSshService()
  const remoteResults = await service.listRemoteSessions({ hosts: [sshHostFixture] })
  const mergedSnapshot = service.mergeSessionSnapshots({
    localSnapshot: { fetchedAt: 0, sessions: [], unreachableHosts: [] },
    remoteResults,
  })

  return {
    errorMessage: remoteResults[0]?.errorMessage,
    sessions: mergedSnapshot.sessions,
    unreachableHostCount: mergedSnapshot.unreachableHosts.length,
  }
}

describe.skipIf(osUtil.resolvePlatform() === OS.WINDOWS)(
  '_SessionsSshService merge seams [contract supplement]',
  () => {
    it('merges remote claude and opencode sessions with host tagging', async () => {
      const shim = await installSshShims()

      try {
        const merged = await listMergedSessions()

        expect(merged.errorMessage).toBeUndefined()
        expect(merged.unreachableHostCount).toBe(0)
        expect(resolveSessionIds(merged.sessions)).toEqual(['cc-remote', 'ses_op_remote'])
        expect(merged.sessions.map((session) => session.provider)).toEqual([
          SessionProviderMapper.CLAUDE_CODE,
          SessionProviderMapper.OPENCODE,
        ])
        expect(
          merged.sessions.every((session) => session.hostId === 'host-1' && session.hostLabel === 'ssh://box'),
        ).toBe(true)
      } finally {
        await shim.restoreEnvironment()
      }
    })

    it('keeps the claude failure message while still merging opencode sessions', async () => {
      const shim = await installSshShims()

      try {
        shim.setClaudeFailure()

        const merged = await listMergedSessions()

        expect(merged.errorMessage).toBe(claudeFailureMessage)
        expect(merged.unreachableHostCount).toBe(1)
        expect(resolveSessionIds(merged.sessions)).toEqual(['ses_op_remote'])
        expect(merged.sessions[0]?.hostId).toBe('host-1')
      } finally {
        await shim.restoreEnvironment()
      }
    })

    it('returns claude sessions only when the opencode exec fails', async () => {
      const shim = await installSshShims()

      try {
        shim.setOpencodeFailure()

        const merged = await listMergedSessions()

        expect(merged.errorMessage).toBeUndefined()
        expect(merged.unreachableHostCount).toBe(0)
        expect(resolveSessionIds(merged.sessions)).toEqual(['cc-remote'])
      } finally {
        await shim.restoreEnvironment()
      }
    })

    it('reports the host unreachable with no sessions when both execs fail', async () => {
      const shim = await installSshShims()

      try {
        shim.setClaudeFailure()
        shim.setOpencodeFailure()

        const merged = await listMergedSessions()

        expect(merged.errorMessage).toBe(claudeFailureMessage)
        expect(merged.unreachableHostCount).toBe(1)
        expect(merged.sessions).toEqual([])
      } finally {
        await shim.restoreEnvironment()
      }
    })
  },
)
