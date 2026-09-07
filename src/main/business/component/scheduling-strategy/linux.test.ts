// Supplements: ./linux.contract.yaml
// Covers what contract.yaml cannot express:
// - inspectRegistration with the timer file present AND systemctl reporting it active
// - the systemd availability probe outcomes (exit status / stdout matrix, binary absent)
// - upsertRegistration / removeRegistration systemctl choreography and written unit files
// All of these need a fake `systemctl` executable prepended to PATH and per-test temp unit dirs.

import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SchedulingStrategyLinuxContractHarness } from '#src/main/business/component/scheduling-strategy/__tests__/_linux-contract-harness'
import { OS } from '#src/shared/business/enum/os-enum'
import { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'
import { osUtil } from '#src/main/util/os-util'

const fakeSystemctlScript = `#!/bin/sh
if [ -n "$USAGE_PULSE_SYSTEMCTL_ARGS_LOG" ]; then
  IFS='|'
  printf '%s\\n' "$*" >> "$USAGE_PULSE_SYSTEMCTL_ARGS_LOG"
fi
case "$USAGE_PULSE_FAKE_SYSTEMCTL_MODE" in
  degraded)
    printf 'degraded\\n'
    exit 1
    ;;
  not-booted)
    printf 'System has not been booted with systemd\\n'
    exit 1
    ;;
  *)
    printf 'running\\n'
    exit 0
    ;;
esac
`

const expectedServiceUnitContent = [
  '[Unit]',
  'Description=Usage Pulse trigger alpha',
  '',
  '[Service]',
  'Type=oneshot',
  'ExecStart=/usr/lib/usage-pulse/usage-pulse --fire-trigger d290f1c9-7d44-4fdd-9d95-1b9d45a8f7e3',
  '',
].join('\n')

const expectedTimerUnitContent = [
  '[Unit]',
  'Description=Usage Pulse trigger alpha schedule',
  '',
  '[Timer]',
  'OnCalendar=Mon,Wed,Sat 09:00',
  'OnCalendar=Mon,Wed,Sat 13:00',
  'Persistent=true',
  '',
  '[Install]',
  'WantedBy=timers.target',
  '',
].join('\n')

const restoreEnvValue = (params: { key: string; value: string | undefined }) => {
  const { key, value } = params
  if (value === undefined) {
    delete process.env[key]
    return
  }

  process.env[key] = value
}

const installFakeSystemctl = async () => {
  const binDir = await mkdtemp(join(tmpdir(), 'usage-pulse-systemctl-bin-'))
  const argsLogPath = join(binDir, 'systemctl-args.log')
  const originalArgsLog = process.env.USAGE_PULSE_SYSTEMCTL_ARGS_LOG
  const originalMode = process.env.USAGE_PULSE_FAKE_SYSTEMCTL_MODE
  const originalPath = process.env.PATH

  await writeFile(join(binDir, 'systemctl'), fakeSystemctlScript, 'utf8')
  await chmod(join(binDir, 'systemctl'), 0o755)
  process.env.PATH = `${binDir}${delimiter}${originalPath}`
  process.env.USAGE_PULSE_SYSTEMCTL_ARGS_LOG = argsLogPath

  return {
    argsLogPath,
    restoreEnvironment: async () => {
      restoreEnvValue({ key: 'USAGE_PULSE_SYSTEMCTL_ARGS_LOG', value: originalArgsLog })
      restoreEnvValue({ key: 'USAGE_PULSE_FAKE_SYSTEMCTL_MODE', value: originalMode })
      process.env.PATH = originalPath
      await rm(binDir, { force: true, recursive: true })
    },
    setMode: (mode: string) => {
      process.env.USAGE_PULSE_FAKE_SYSTEMCTL_MODE = mode
    },
  }
}

const installSystemctllessPath = async () => {
  const binDir = await mkdtemp(join(tmpdir(), 'usage-pulse-systemctl-absent-'))
  const originalPath = process.env.PATH

  process.env.PATH = binDir

  return {
    restoreEnvironment: async () => {
      process.env.PATH = originalPath
      await rm(binDir, { force: true, recursive: true })
    },
  }
}

const readSystemctlInvocations = async (params: { argsLogPath: string }) => {
  const { argsLogPath } = params
  return (await readFile(argsLogPath, 'utf8')).trim().split('\n')
}

describe.skipIf(osUtil.resolvePlatform() === OS.WINDOWS)('SchedulingStrategyLinux [contract supplement]', () => {
  it('reports a trigger as registered when its timer unit file exists and systemctl reports it active', async () => {
    const shim = await installFakeSystemctl()
    const unitDir = await mkdtemp(join(tmpdir(), 'usage-pulse-unit-dir-'))

    try {
      await writeFile(join(unitDir, 'usage-pulse-trigger-alpha.timer'), '[Timer]\nOnCalendar=Mon 09:00\n', 'utf8')

      const strategy = new SchedulingStrategyLinuxContractHarness({
        configDir: unitDir,
        isSystemdUserAvailable: false,
      })
      const inspection = await strategy.inspectRegistration({ triggerId: 'alpha' })
      const systemctlInvocations = await readSystemctlInvocations({ argsLogPath: shim.argsLogPath })

      expect(inspection).toEqual({ isRegistered: true })
      expect(systemctlInvocations).toEqual(['--user|is-active|usage-pulse-trigger-alpha.timer'])
    } finally {
      await shim.restoreEnvironment()
      await rm(unitDir, { force: true, recursive: true })
    }
  })

  it('detects an available systemd user session when the probe exits zero', async () => {
    const shim = await installFakeSystemctl()
    const unitDir = await mkdtemp(join(tmpdir(), 'usage-pulse-unit-dir-'))

    try {
      const strategy = new SchedulingStrategyLinuxContractHarness({ configDir: unitDir, homeDir: '/home/test-user' })

      expect(strategy.isSupported).toBe(true)
    } finally {
      await shim.restoreEnvironment()
      await rm(unitDir, { force: true, recursive: true })
    }
  })

  it('treats a degraded systemd session as available', async () => {
    const shim = await installFakeSystemctl()
    const unitDir = await mkdtemp(join(tmpdir(), 'usage-pulse-unit-dir-'))

    try {
      shim.setMode('degraded')

      const strategy = new SchedulingStrategyLinuxContractHarness({ configDir: unitDir, homeDir: '/home/test-user' })

      expect(strategy.isSupported).toBe(true)
    } finally {
      await shim.restoreEnvironment()
      await rm(unitDir, { force: true, recursive: true })
    }
  })

  it('rejects a systemctl stub that exits non-zero with junk stdout on the probe', async () => {
    const shim = await installFakeSystemctl()
    const unitDir = await mkdtemp(join(tmpdir(), 'usage-pulse-unit-dir-'))

    try {
      shim.setMode('not-booted')

      const strategy = new SchedulingStrategyLinuxContractHarness({ configDir: unitDir, homeDir: '/home/test-user' })

      expect(strategy.isSupported).toBe(false)
    } finally {
      await shim.restoreEnvironment()
      await rm(unitDir, { force: true, recursive: true })
    }
  })

  it('reports systemd unavailable when the systemctl binary is missing', async () => {
    const pathOverride = await installSystemctllessPath()
    const unitDir = await mkdtemp(join(tmpdir(), 'usage-pulse-unit-dir-'))

    try {
      const strategy = new SchedulingStrategyLinuxContractHarness({ configDir: unitDir, homeDir: '/home/test-user' })

      expect(strategy.isSupported).toBe(false)
    } finally {
      await pathOverride.restoreEnvironment()
      await rm(unitDir, { force: true, recursive: true })
    }
  })

  it('writes both unit files, then daemon-reloads, enables and restarts the timer on upsert', async () => {
    const shim = await installFakeSystemctl()
    const unitDir = await mkdtemp(join(tmpdir(), 'usage-pulse-unit-dir-'))

    try {
      const strategy = new SchedulingStrategyLinuxContractHarness({
        configDir: unitDir,
        isSystemdUserAvailable: false,
      })
      await strategy.upsertRegistration({
        days: [ScheduleTriggerDayMapper.MONDAY, ScheduleTriggerDayMapper.WEDNESDAY, ScheduleTriggerDayMapper.SATURDAY],
        executableArgs: ['--fire-trigger', 'd290f1c9-7d44-4fdd-9d95-1b9d45a8f7e3'],
        executablePath: '/usr/lib/usage-pulse/usage-pulse',
        times: ['09:00', '13:00'],
        triggerId: 'alpha',
      })
      const serviceUnitContent = await readFile(join(unitDir, 'usage-pulse-trigger-alpha.service'), 'utf8')
      const timerUnitContent = await readFile(join(unitDir, 'usage-pulse-trigger-alpha.timer'), 'utf8')
      const systemctlInvocations = await readSystemctlInvocations({ argsLogPath: shim.argsLogPath })

      expect(serviceUnitContent).toBe(expectedServiceUnitContent)
      expect(timerUnitContent).toBe(expectedTimerUnitContent)
      expect(systemctlInvocations).toEqual([
        '--user|daemon-reload',
        '--user|enable|usage-pulse-trigger-alpha.timer',
        '--user|restart|usage-pulse-trigger-alpha.timer',
      ])
    } finally {
      await shim.restoreEnvironment()
      await rm(unitDir, { force: true, recursive: true })
    }
  })

  it('disables, resets failure, removes both unit files and daemon-reloads on remove when the timer file exists', async () => {
    const shim = await installFakeSystemctl()
    const unitDir = await mkdtemp(join(tmpdir(), 'usage-pulse-unit-dir-'))

    try {
      await writeFile(join(unitDir, 'usage-pulse-trigger-alpha.service'), 'stale\n', 'utf8')
      await writeFile(join(unitDir, 'usage-pulse-trigger-alpha.timer'), 'stale\n', 'utf8')

      const strategy = new SchedulingStrategyLinuxContractHarness({
        configDir: unitDir,
        isSystemdUserAvailable: false,
      })
      await strategy.removeRegistration({ triggerId: 'alpha' })
      const remainingUnitFiles = await readdir(unitDir)
      const systemctlInvocations = await readSystemctlInvocations({ argsLogPath: shim.argsLogPath })

      expect(remainingUnitFiles).toEqual([])
      expect(systemctlInvocations).toEqual([
        '--user|disable|--now|usage-pulse-trigger-alpha.timer',
        '--user|reset-failed|usage-pulse-trigger-alpha.service',
        '--user|daemon-reload',
      ])
    } finally {
      await shim.restoreEnvironment()
      await rm(unitDir, { force: true, recursive: true })
    }
  })

  it('skips disabling but still resets failure and daemon-reloads on remove when the timer file is absent', async () => {
    const shim = await installFakeSystemctl()
    const unitDir = await mkdtemp(join(tmpdir(), 'usage-pulse-unit-dir-'))

    try {
      const strategy = new SchedulingStrategyLinuxContractHarness({
        configDir: unitDir,
        isSystemdUserAvailable: false,
      })
      await strategy.removeRegistration({ triggerId: 'alpha' })
      const remainingUnitFiles = await readdir(unitDir)
      const systemctlInvocations = await readSystemctlInvocations({ argsLogPath: shim.argsLogPath })

      expect(remainingUnitFiles).toEqual([])
      expect(systemctlInvocations).toEqual([
        '--user|reset-failed|usage-pulse-trigger-alpha.service',
        '--user|daemon-reload',
      ])
    } finally {
      await shim.restoreEnvironment()
      await rm(unitDir, { force: true, recursive: true })
    }
  })
})
