import { execFile, spawnSync } from 'node:child_process'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import type {
  ISchedulingInspection,
  ISchedulingRegistrationParams,
  ISchedulingStrategy,
} from '#src/main/business/component/scheduling-strategy/scheduling-strategy'
import { config } from '#src/main/util/config'
import { constant } from '#src/main/util/constant'
import { errorUtil } from '#src/main/util/error-util'
import { OS, osUtil } from '#src/main/util/os-util'
import { TRIGGER_DAYS, type TriggerDay } from '#src/shared/trigger-model'

const execFileAsync = promisify(execFile)

export class SchedulingStrategyLinux implements ISchedulingStrategy {
  readonly isSupported: boolean

  protected readonly _homeDir: string
  protected readonly _systemctlProbeTimeoutMs = 5000
  protected readonly _systemctlTimeoutMs = 10000
  protected readonly _systemdDayByTriggerDay: Record<TriggerDay, string> = {
    friday: 'Fri',
    monday: 'Mon',
    saturday: 'Sat',
    sunday: 'Sun',
    thursday: 'Thu',
    tuesday: 'Tue',
    wednesday: 'Wed',
  }

  protected readonly _systemdExecQuoteTriggerCharacters = new Set([
    ' ',
    '\t',
    '"',
    "'",
    '\\',
    ';',
    ',',
    '?',
    '*',
    '[',
    ']',
    '{',
    '}',
    '$',
    '&',
    '<',
    '>',
    '|',
    '(',
    ')',
    '`',
    '!',
    '#',
    '~',
  ])

  protected readonly _systemdUnitNamePrefix = 'usage-pulse-trigger-'
  protected readonly _unitDir: string

  constructor(params: { configDir?: string; homeDir?: string; isSystemdUserAvailable?: boolean } = {}) {
    this._assertLinuxOsPlatform()
    this._homeDir = params.homeDir ?? homedir()
    this._unitDir = params.configDir ?? this._resolveDefaultUnitDir()
    this.isSupported = params.isSystemdUserAvailable ?? this._resolveIsSystemdUserAvailable()
  }

  getSchedulingPlatform(): OS {
    return OS.LINUX
  }

  async inspectRegistration(params: { triggerId: string }): Promise<ISchedulingInspection> {
    const isTimerUnitFilePresent = await this._resolveIsTimerUnitFilePresent({ triggerId: params.triggerId })
    const isTimerActive = await this._resolveIsTimerActive({ triggerId: params.triggerId })

    return { isRegistered: isTimerUnitFilePresent && isTimerActive }
  }

  async listRegistrationIds(): Promise<string[]> {
    const unitFileNames = await this._resolveUnitDirFileNames()

    return unitFileNames
      .filter((fileName) => {
        return fileName.startsWith(this._systemdUnitNamePrefix) && fileName.endsWith('.timer')
      })
      .map((fileName) => {
        return fileName.slice(this._systemdUnitNamePrefix.length, -'.timer'.length)
      })
  }

  async removeRegistration(params: { triggerId: string }): Promise<void> {
    await this._disableTimerToleratingAbsence({ triggerId: params.triggerId })
    await this._resetFailedService({ triggerId: params.triggerId })
    await this._removeUnitFiles({ triggerId: params.triggerId })
    await this._reloadDaemon()
  }

  async upsertRegistration(params: ISchedulingRegistrationParams): Promise<void> {
    this._assertRegistrationParams(params)
    await this._writeUnitFiles(params)
    await this._reloadDaemon()
    await this._execSystemctl({
      args: ['enable', this._resolveTimerUnitName({ triggerId: params.triggerId })],
      errorMessage: `enabling the systemd user timer for trigger '${params.triggerId}' failed`,
    })
    await this._execSystemctl({
      args: ['restart', this._resolveTimerUnitName({ triggerId: params.triggerId })],
      errorMessage: `restarting the systemd user timer for trigger '${params.triggerId}' failed`,
    })
  }

  protected _assertLinuxOsPlatform(): void {
    const platform = osUtil.resolvePlatform()

    if (platform !== OS.LINUX) {
      throw new Error('Scheduling triggers with systemd user timers are only supported on Linux for now')
    }
  }

  protected _assertRegistrationParams(params: ISchedulingRegistrationParams): void {
    if (!/^[A-Za-z0-9_-]+$/.test(params.triggerId)) {
      throw new Error(
        `Invalid trigger id '${params.triggerId}': only alphanumerics, underscores and hyphens are allowed`,
      )
    }

    if (params.executablePath.trim() === '') {
      throw new Error('Trigger registration requires a non-empty executablePath')
    }

    if (params.executableArgs.length === 0) {
      throw new Error('Trigger registration requires at least one executable argument')
    }

    const isEmptyArgument = params.executableArgs.some((argument) => {
      return argument.trim() === ''
    })

    if (isEmptyArgument) {
      throw new Error('Trigger registration requires non-empty executable arguments')
    }

    if (params.days.length === 0) {
      throw new Error('Trigger registration requires at least one day')
    }

    const invalidDays = params.days.filter((day) => {
      return !Object.hasOwn(this._systemdDayByTriggerDay, day)
    })

    if (invalidDays.length > 0) {
      throw new Error(`Invalid trigger days: ${invalidDays.join(', ')}`)
    }

    if (params.times.length === 0) {
      throw new Error('Trigger registration requires at least one time')
    }

    params.times.forEach((time) => {
      this._parseTimeOfDay({ time })
    })
  }

  protected _buildOnCalendarValues(params: { days: TriggerDay[]; times: string[] }): string[] {
    const daysValue = TRIGGER_DAYS.filter((day) => {
      return params.days.includes(day)
    })
      .map((day) => {
        return this._systemdDayByTriggerDay[day]
      })
      .join(',')

    return params.times.map((time) => {
      return `${daysValue} ${time}`
    })
  }

  protected _buildServiceUnitContent(params: ISchedulingRegistrationParams): string {
    const execStartValue = [params.executablePath, ...params.executableArgs]
      .map((argument) => {
        return this._formatSystemdExecArg(argument)
      })
      .join(' ')
    const unitLines = [
      '[Unit]',
      `Description=Usage Pulse trigger ${params.triggerId}`,
      '',
      '[Service]',
      'Type=oneshot',
      `ExecStart=${execStartValue}`,
    ]

    return `${unitLines.join('\n')}\n`
  }

  protected _buildTimerUnitContent(params: ISchedulingRegistrationParams): string {
    const onCalendarLines = this._buildOnCalendarValues({ days: params.days, times: params.times }).map((value) => {
      return `OnCalendar=${value}`
    })
    const unitLines = [
      '[Unit]',
      `Description=Usage Pulse trigger ${params.triggerId} schedule`,
      '',
      '[Timer]',
      ...onCalendarLines,
      'Persistent=true',
      '',
      '[Install]',
      'WantedBy=timers.target',
    ]

    return `${unitLines.join('\n')}\n`
  }

  protected async _disableTimerToleratingAbsence(params: { triggerId: string }): Promise<void> {
    const isTimerUnitFilePresent = await this._resolveIsTimerUnitFilePresent({ triggerId: params.triggerId })

    if (!isTimerUnitFilePresent) {
      return
    }

    try {
      await this._execSystemctl({
        args: ['disable', '--now', this._resolveTimerUnitName({ triggerId: params.triggerId })],
        errorMessage: `disabling the systemd user timer for trigger '${params.triggerId}' failed`,
      })
    } catch (error) {
      if (!this._resolveIsUnitAbsentError(error)) {
        throw error
      }
    }
  }

  protected async _execSystemctl(params: { args: string[]; errorMessage: string }): Promise<void> {
    try {
      await execFileAsync('systemctl', ['--user', ...params.args], { timeout: this._systemctlTimeoutMs })
    } catch (error) {
      throw new Error(`${params.errorMessage}: ${this._resolveSystemctlErrorMessage(error)}`)
    }
  }

  protected _formatSystemdExecArg(value: string): string {
    const hasQuoteTriggerCharacter = Array.from(this._systemdExecQuoteTriggerCharacters).some((character) => {
      return value.includes(character)
    })

    if (!hasQuoteTriggerCharacter) {
      return value.replaceAll('%', '%%')
    }

    const quotedValue = value.replaceAll('%', '%%').replaceAll('\\', '\\\\').replaceAll('"', '\\"')

    return `"${quotedValue}"`
  }

  protected _parseTimeOfDay(params: { time: string }): { hour: number; minute: number } {
    const match = constant.twoDigitTimeRegex.exec(params.time)
    const hourText = match?.[1]
    const minuteText = match?.[2]

    if (hourText === undefined || minuteText === undefined) {
      throw new Error(`Invalid trigger time '${params.time}': expected the HH:mm format`)
    }

    const hour = Number.parseInt(hourText, 10)
    const minute = Number.parseInt(minuteText, 10)

    if (hour > 23 || minute > 59) {
      throw new Error(`Invalid trigger time '${params.time}': hour must be within 00-23 and minute within 00-59`)
    }

    return { hour, minute }
  }

  protected _reloadDaemon(): Promise<void> {
    return this._execSystemctl({
      args: ['daemon-reload'],
      errorMessage: 'reloading the systemd user daemon failed',
    })
  }

  protected async _removeUnitFiles(params: { triggerId: string }): Promise<void> {
    await rm(this._resolveServiceUnitPath({ triggerId: params.triggerId }), { force: true })
    await rm(this._resolveTimerUnitPath({ triggerId: params.triggerId }), { force: true })
  }

  protected async _resetFailedService(params: { triggerId: string }): Promise<void> {
    try {
      await this._execSystemctl({
        args: ['reset-failed', this._resolveServiceUnitName({ triggerId: params.triggerId })],
        errorMessage: `resetting the systemd user service state for trigger '${params.triggerId}' failed`,
      })
    } catch {
      return
    }
  }

  protected _resolveDefaultUnitDir(): string {
    return join(config.xdgConfigHome ?? join(this._homeDir, '.config'), 'systemd', 'user')
  }

  protected _resolveIsSystemdUserAvailable(): boolean {
    const result = spawnSync('systemctl', ['--user', 'is-system-running'], { timeout: this._systemctlProbeTimeoutMs })
    const hasAcceptableStatus =
      result.status === 0 ||
      /^(running|degraded|starting|initializing|stopping|maintenance)/.test(String(result.stdout).trim())

    return result.error === undefined && hasAcceptableStatus
  }

  protected async _resolveIsTimerActive(params: { triggerId: string }): Promise<boolean> {
    try {
      await execFileAsync(
        'systemctl',
        ['--user', 'is-active', this._resolveTimerUnitName({ triggerId: params.triggerId })],
        {
          timeout: this._systemctlTimeoutMs,
        },
      )

      return true
    } catch {
      return false
    }
  }

  protected async _resolveIsTimerUnitFilePresent(params: { triggerId: string }): Promise<boolean> {
    try {
      await stat(this._resolveTimerUnitPath({ triggerId: params.triggerId }))

      return true
    } catch {
      return false
    }
  }

  protected _resolveIsUnitAbsentError(error: unknown): boolean {
    const message = errorUtil.resolveMessage(error).toLowerCase()

    return message.includes('not found') || message.includes('not loaded') || message.includes('does not exist')
  }

  protected _resolveServiceUnitName(params: { triggerId: string }): string {
    return `${this._resolveUnitBaseName({ triggerId: params.triggerId })}.service`
  }

  protected _resolveServiceUnitPath(params: { triggerId: string }): string {
    return join(this._unitDir, this._resolveServiceUnitName({ triggerId: params.triggerId }))
  }

  protected _resolveSystemctlErrorMessage(error: unknown): string {
    const stderr = (error as { stderr?: unknown }).stderr

    if (typeof stderr === 'string' && stderr.trim() !== '') {
      return stderr.trim()
    }

    return errorUtil.resolveMessage(error)
  }

  protected _resolveTimerUnitName(params: { triggerId: string }): string {
    return `${this._resolveUnitBaseName({ triggerId: params.triggerId })}.timer`
  }

  protected _resolveTimerUnitPath(params: { triggerId: string }): string {
    return join(this._unitDir, this._resolveTimerUnitName({ triggerId: params.triggerId }))
  }

  protected _resolveUnitBaseName(params: { triggerId: string }): string {
    return `${this._systemdUnitNamePrefix}${params.triggerId}`
  }

  protected async _resolveUnitDirFileNames(): Promise<string[]> {
    try {
      return await readdir(this._unitDir)
    } catch {
      return []
    }
  }

  protected async _writeUnitFiles(params: ISchedulingRegistrationParams): Promise<void> {
    await mkdir(this._unitDir, { recursive: true })
    await writeFile(
      this._resolveServiceUnitPath({ triggerId: params.triggerId }),
      this._buildServiceUnitContent(params),
      'utf8',
    )
    await writeFile(
      this._resolveTimerUnitPath({ triggerId: params.triggerId }),
      this._buildTimerUnitContent(params),
      'utf8',
    )
  }
}
