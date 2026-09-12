import { execFile } from 'node:child_process'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { homedir, userInfo } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

import type {
  SchedulingInspection,
  SchedulingRegistrationParams,
  SchedulingStrategy,
} from '#src/main/business/component/scheduling-strategy/scheduling-strategy'
import { config } from '#src/main/util/config'
import { constant } from '#src/main/util/constant'
import { errorUtil } from '#src/main/util/error-util'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'
import { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'

const execFileAsync = promisify(execFile)

type LaunchdCalendarInterval = {
  hour: number
  minute: number
  weekday: number
}

export class SchedulingStrategyMacLaunchd implements SchedulingStrategy {
  readonly isSupported = true

  protected readonly _homeDir: string
  protected readonly _labelPrefix = 'com.usage-pulse.trigger.'
  protected readonly _launchctlTimeoutMs = config.launchctlTimeoutMs
  protected readonly _launchdWeekdayByTriggerDay: Record<ScheduleTriggerDayMapper, number> = {
    [ScheduleTriggerDayMapper.FRIDAY]: 5,
    [ScheduleTriggerDayMapper.MONDAY]: 1,
    [ScheduleTriggerDayMapper.SATURDAY]: 6,
    [ScheduleTriggerDayMapper.SUNDAY]: 0,
    [ScheduleTriggerDayMapper.THURSDAY]: 4,
    [ScheduleTriggerDayMapper.TUESDAY]: 2,
    [ScheduleTriggerDayMapper.WEDNESDAY]: 3,
  }

  protected readonly _uid: number

  constructor(params: { homeDir: string; uid: number } = { homeDir: homedir(), uid: userInfo().uid }) {
    const { homeDir, uid } = params
    this._assertMacOsPlatform()
    this._homeDir = homeDir
    this._uid = uid
  }

  getSchedulingPlatform(): OS {
    return OS.MACOS
  }

  async inspectRegistration(params: { triggerId: string }): Promise<SchedulingInspection> {
    const { triggerId } = params
    const isPlistPresent = await this._resolveIsPlistPresent({ triggerId })
    const isLabelLoaded = await this._resolveIsLabelLoaded({ triggerId })

    return { isRegistered: isPlistPresent && isLabelLoaded }
  }

  async listRegistrationIds(): Promise<string[]> {
    const plistFileNames = await this._resolveLaunchAgentsFileNames()

    return plistFileNames
      .filter((fileName) => {
        return fileName.startsWith(this._labelPrefix) && fileName.endsWith('.plist')
      })
      .map((fileName) => {
        return fileName.slice(this._labelPrefix.length, -'.plist'.length)
      })
  }

  async removeRegistration(params: { triggerId: string }): Promise<void> {
    const { triggerId } = params
    await this._bootoutIfLoaded({ triggerId })
    await this._removePlist({ triggerId })
  }

  async upsertRegistration(params: SchedulingRegistrationParams): Promise<void> {
    const { triggerId } = params
    this._assertRegistrationParams(params)
    await this._bootoutIfLoaded({ triggerId })
    await this._writePlist(params)
    await this._bootstrapLabel({ triggerId })
  }

  protected _assertMacOsPlatform(): void {
    const platform = osUtil.resolvePlatform()

    if (platform !== OS.MACOS) {
      throw new Error('Scheduling triggers with a launchd agent is only supported on macOS for now')
    }
  }

  protected _assertRegistrationParams(params: SchedulingRegistrationParams): void {
    const { triggerId, executablePath, executableArgs, days, times } = params
    if (!/^[A-Za-z0-9_-]+$/.test(triggerId)) {
      throw new Error(`Invalid trigger id '${triggerId}': only alphanumerics, underscores and hyphens are allowed`)
    }

    if (executablePath.trim() === '') {
      throw new Error('Trigger registration requires a non-empty executablePath')
    }

    if (executableArgs.length === 0) {
      throw new Error('Trigger registration requires at least one executable argument')
    }

    const isEmptyArgument = executableArgs.some((argument) => {
      return argument.trim() === ''
    })

    if (isEmptyArgument) {
      throw new Error('Trigger registration requires non-empty executable arguments')
    }

    if (days.length === 0) {
      throw new Error('Trigger registration requires at least one day')
    }

    const invalidDays = days.filter((day) => {
      return !Object.hasOwn(this._launchdWeekdayByTriggerDay, day)
    })

    if (invalidDays.length > 0) {
      throw new Error(`Invalid trigger days: ${invalidDays.join(', ')}`)
    }

    if (times.length === 0) {
      throw new Error('Trigger registration requires at least one time')
    }

    times.forEach((time) => {
      this._parseTimeOfDay({ time })
    })
  }

  protected async _bootoutIfLoaded(params: { triggerId: string }): Promise<void> {
    const { triggerId } = params
    const isLabelLoaded = await this._resolveIsLabelLoaded({ triggerId })

    if (!isLabelLoaded) {
      return
    }

    await this._execLaunchctl({
      args: ['bootout', this._resolveDomainTarget(), this._resolvePlistPath({ triggerId })],
      errorMessage: `unloading the launchd agent for trigger '${triggerId}' failed`,
    })
  }

  protected _bootstrapLabel(params: { triggerId: string }): Promise<void> {
    const { triggerId } = params

    return this._execLaunchctl({
      args: ['bootstrap', this._resolveDomainTarget(), this._resolvePlistPath({ triggerId })],
      errorMessage: `loading the launchd agent for trigger '${triggerId}' failed`,
    })
  }

  protected _buildCalendarIntervals(params: {
    days: ScheduleTriggerDayMapper[]
    times: string[]
  }): LaunchdCalendarInterval[] {
    const { days, times } = params

    return days.flatMap((day) => {
      return times.map((time) => {
        const timeOfDay = this._parseTimeOfDay({ time })

        return {
          hour: timeOfDay.hour,
          minute: timeOfDay.minute,
          weekday: this._launchdWeekdayByTriggerDay[day],
        }
      })
    })
  }

  protected _buildProgramArgumentLines(params: SchedulingRegistrationParams): string[] {
    const { executablePath, executableArgs } = params

    return [executablePath, ...executableArgs].map((argument) => {
      return `\t\t<string>${this._escapeXml(argument)}</string>`
    })
  }

  protected _buildPlistXml(params: SchedulingRegistrationParams): string {
    const { days, times, triggerId } = params
    const calendarIntervals = this._buildCalendarIntervals({ days, times })
    const calendarIntervalLines = calendarIntervals.flatMap((interval) => {
      return [
        '\t\t<dict>',
        '\t\t\t<key>Hour</key>',
        `\t\t\t<integer>${String(interval.hour)}</integer>`,
        '\t\t\t<key>Minute</key>',
        `\t\t\t<integer>${String(interval.minute)}</integer>`,
        '\t\t\t<key>Weekday</key>',
        `\t\t\t<integer>${String(interval.weekday)}</integer>`,
        '\t\t</dict>',
      ]
    })
    const xmlLines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      '<dict>',
      '\t<key>Label</key>',
      `\t<string>${this._escapeXml(this._resolveLabel({ triggerId }))}</string>`,
      '\t<key>ProgramArguments</key>',
      '\t<array>',
      ...this._buildProgramArgumentLines(params),
      '\t</array>',
      '\t<key>StartCalendarInterval</key>',
      '\t<array>',
      ...calendarIntervalLines,
      '\t</array>',
      '</dict>',
      '</plist>',
    ]

    return `${xmlLines.join('\n')}\n`
  }

  protected _escapeXml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;')
  }

  protected async _execLaunchctl(params: { args: string[]; errorMessage: string }): Promise<void> {
    const { args, errorMessage } = params
    try {
      await execFileAsync('launchctl', args, { timeout: this._launchctlTimeoutMs })
    } catch (error) {
      throw new Error(`${errorMessage}: ${this._resolveLaunchctlErrorMessage(error)}`)
    }
  }

  protected _parseTimeOfDay(params: { time: string }): { hour: number; minute: number } {
    const { time } = params
    const match = constant.twoDigitTimeRegex.exec(time)
    const hourText = match?.[1]
    const minuteText = match?.[2]

    if (hourText === undefined || minuteText === undefined) {
      throw new Error(`Invalid trigger time '${time}': expected the HH:mm format`)
    }

    const hour = Number.parseInt(hourText, 10)
    const minute = Number.parseInt(minuteText, 10)

    if (hour > 23 || minute > 59) {
      throw new Error(`Invalid trigger time '${time}': hour must be within 00-23 and minute within 00-59`)
    }

    return { hour, minute }
  }

  protected async _removePlist(params: { triggerId: string }): Promise<void> {
    const { triggerId } = params
    await rm(this._resolvePlistPath({ triggerId }), { force: true })
  }

  protected _resolveDomainTarget(): string {
    return `gui/${String(this._uid)}`
  }

  protected async _resolveIsLabelLoaded(params: { triggerId: string }): Promise<boolean> {
    const { triggerId } = params
    try {
      await execFileAsync('launchctl', ['print', this._resolveServiceTarget({ triggerId })], {
        timeout: this._launchctlTimeoutMs,
      })

      return true
    } catch {
      return false
    }
  }

  protected async _resolveIsPlistPresent(params: { triggerId: string }): Promise<boolean> {
    const { triggerId } = params
    try {
      await stat(this._resolvePlistPath({ triggerId }))

      return true
    } catch {
      return false
    }
  }

  protected async _resolveLaunchAgentsFileNames(): Promise<string[]> {
    try {
      return await readdir(join(this._homeDir, 'Library', 'LaunchAgents'))
    } catch {
      return []
    }
  }

  protected _resolveLabel(params: { triggerId: string }): string {
    const { triggerId } = params

    return `${this._labelPrefix}${triggerId}`
  }

  protected _resolveLaunchctlErrorMessage(error: unknown): string {
    const stderr = (error as { stderr?: unknown }).stderr

    if (typeof stderr === 'string' && stderr.trim() !== '') {
      return stderr.trim()
    }

    return errorUtil.resolveMessage(error)
  }

  protected _resolvePlistPath(params: { triggerId: string }): string {
    const { triggerId } = params
    const plistFileName = `${this._resolveLabel({ triggerId })}.plist`

    return join(this._homeDir, 'Library', 'LaunchAgents', plistFileName)
  }

  protected _resolveServiceTarget(params: { triggerId: string }): string {
    const { triggerId } = params

    return `${this._resolveDomainTarget()}/${this._resolveLabel({ triggerId })}`
  }

  protected async _writePlist(params: SchedulingRegistrationParams): Promise<void> {
    const { triggerId } = params
    const plistPath = this._resolvePlistPath({ triggerId })

    await mkdir(dirname(plistPath), { recursive: true })
    await writeFile(plistPath, this._buildPlistXml(params), 'utf8')
  }
}
