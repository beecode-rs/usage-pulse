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

  constructor(params: { homeDir?: string; uid?: number } = {}) {
    this._assertMacOsPlatform()
    this._homeDir = params.homeDir ?? homedir()
    this._uid = params.uid ?? userInfo().uid
  }

  getSchedulingPlatform(): OS {
    return OS.MACOS
  }

  async inspectRegistration(params: { triggerId: string }): Promise<SchedulingInspection> {
    const isPlistPresent = await this._resolveIsPlistPresent({ triggerId: params.triggerId })
    const isLabelLoaded = await this._resolveIsLabelLoaded({ triggerId: params.triggerId })

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
    await this._bootoutIfLoaded({ triggerId: params.triggerId })
    await this._removePlist({ triggerId: params.triggerId })
  }

  async upsertRegistration(params: SchedulingRegistrationParams): Promise<void> {
    this._assertRegistrationParams(params)
    await this._bootoutIfLoaded({ triggerId: params.triggerId })
    await this._writePlist(params)
    await this._bootstrapLabel({ triggerId: params.triggerId })
  }

  protected _assertMacOsPlatform(): void {
    const platform = osUtil.resolvePlatform()

    if (platform !== OS.MACOS) {
      throw new Error('Scheduling triggers with a launchd agent is only supported on macOS for now')
    }
  }

  protected _assertRegistrationParams(params: SchedulingRegistrationParams): void {
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
      return !Object.hasOwn(this._launchdWeekdayByTriggerDay, day)
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

  protected async _bootoutIfLoaded(params: { triggerId: string }): Promise<void> {
    const isLabelLoaded = await this._resolveIsLabelLoaded({ triggerId: params.triggerId })

    if (!isLabelLoaded) {
      return
    }

    await this._execLaunchctl({
      args: ['bootout', this._resolveDomainTarget(), this._resolvePlistPath({ triggerId: params.triggerId })],
      errorMessage: `unloading the launchd agent for trigger '${params.triggerId}' failed`,
    })
  }

  protected _bootstrapLabel(params: { triggerId: string }): Promise<void> {
    return this._execLaunchctl({
      args: ['bootstrap', this._resolveDomainTarget(), this._resolvePlistPath({ triggerId: params.triggerId })],
      errorMessage: `loading the launchd agent for trigger '${params.triggerId}' failed`,
    })
  }

  protected _buildCalendarIntervals(params: {
    days: ScheduleTriggerDayMapper[]
    times: string[]
  }): LaunchdCalendarInterval[] {
    return params.days.flatMap((day) => {
      return params.times.map((time) => {
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
    return [params.executablePath, ...params.executableArgs].map((argument) => {
      return `\t\t<string>${this._escapeXml(argument)}</string>`
    })
  }

  protected _buildPlistXml(params: SchedulingRegistrationParams): string {
    const calendarIntervals = this._buildCalendarIntervals({ days: params.days, times: params.times })
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
      `\t<string>${this._escapeXml(this._resolveLabel({ triggerId: params.triggerId }))}</string>`,
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
    try {
      await execFileAsync('launchctl', params.args, { timeout: this._launchctlTimeoutMs })
    } catch (error) {
      throw new Error(`${params.errorMessage}: ${this._resolveLaunchctlErrorMessage(error)}`)
    }
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

  protected async _removePlist(params: { triggerId: string }): Promise<void> {
    await rm(this._resolvePlistPath({ triggerId: params.triggerId }), { force: true })
  }

  protected _resolveDomainTarget(): string {
    return `gui/${String(this._uid)}`
  }

  protected async _resolveIsLabelLoaded(params: { triggerId: string }): Promise<boolean> {
    try {
      await execFileAsync('launchctl', ['print', this._resolveServiceTarget({ triggerId: params.triggerId })], {
        timeout: this._launchctlTimeoutMs,
      })

      return true
    } catch {
      return false
    }
  }

  protected async _resolveIsPlistPresent(params: { triggerId: string }): Promise<boolean> {
    try {
      await stat(this._resolvePlistPath({ triggerId: params.triggerId }))

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
    return `${this._labelPrefix}${params.triggerId}`
  }

  protected _resolveLaunchctlErrorMessage(error: unknown): string {
    const stderr = (error as { stderr?: unknown }).stderr

    if (typeof stderr === 'string' && stderr.trim() !== '') {
      return stderr.trim()
    }

    return errorUtil.resolveMessage(error)
  }

  protected _resolvePlistPath(params: { triggerId: string }): string {
    const plistFileName = `${this._resolveLabel({ triggerId: params.triggerId })}.plist`

    return join(this._homeDir, 'Library', 'LaunchAgents', plistFileName)
  }

  protected _resolveServiceTarget(params: { triggerId: string }): string {
    return `${this._resolveDomainTarget()}/${this._resolveLabel({ triggerId: params.triggerId })}`
  }

  protected async _writePlist(params: SchedulingRegistrationParams): Promise<void> {
    const plistPath = this._resolvePlistPath({ triggerId: params.triggerId })

    await mkdir(dirname(plistPath), { recursive: true })
    await writeFile(plistPath, this._buildPlistXml(params), 'utf8')
  }
}
