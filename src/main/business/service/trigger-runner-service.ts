import { randomUUID } from 'node:crypto'

import { type SettingsRepo } from '#src/main/business/repo/settings-repo'
import { type TriggerRunLogRepo } from '#src/main/business/repo/trigger-run-log-repo'
import { TriggerCommandService } from '#src/main/business/service/trigger-command-service'
import { dummyTriggerPopup } from '#src/main/lib/dummy-trigger-popup'
import { constant } from '#src/main/util/constant'
import { errorUtil } from '#src/main/util/error-util'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'
import { ScheduleTriggerRunPhaseMapper } from '#src/shared/business/enum/schedule-trigger-run-phase-mapper-enum'
import { ScheduleTriggerRunSkipReasonMapper } from '#src/shared/business/enum/schedule-trigger-run-skip-reason-mapper-enum'
import { type ScheduleTriggerRunSourceMapper } from '#src/shared/business/enum/schedule-trigger-run-source-mapper-enum'
import {
  type ScheduleTriggerConfig,
  type ScheduleTriggerRunLogEntry,
} from '#src/shared/business/model/schedule-trigger-model'
import { type AppSettings, type DummyTrackerConfig } from '#src/shared/business/model/settings-model'
import { constant as sharedConstant } from '#src/shared/util/constant'

export type DummyTrackerAction = (params: { trackerName: string }) => Promise<void>

export class TriggerRunnerService {
  protected readonly _commandService: TriggerCommandService
  protected readonly _dummyAction: DummyTrackerAction
  protected readonly _now: () => Date
  protected readonly _runLogRepo: TriggerRunLogRepo
  protected readonly _settingsRepo: SettingsRepo
  protected readonly _staleSkipMs: number
  protected readonly _triggerDayByWeekdayIndex: readonly ScheduleTriggerDayMapper[] = [
    ScheduleTriggerDayMapper.SUNDAY,
    ScheduleTriggerDayMapper.MONDAY,
    ScheduleTriggerDayMapper.TUESDAY,
    ScheduleTriggerDayMapper.WEDNESDAY,
    ScheduleTriggerDayMapper.THURSDAY,
    ScheduleTriggerDayMapper.FRIDAY,
    ScheduleTriggerDayMapper.SATURDAY,
  ]

  constructor(params: {
    commandService?: TriggerCommandService
    dummyAction?: DummyTrackerAction
    now?: () => Date
    runLogRepo: TriggerRunLogRepo
    settingsRepo: SettingsRepo
    staleSkipMs?: number
  }) {
    this._commandService = params.commandService ?? new TriggerCommandService()
    this._dummyAction = params.dummyAction ?? dummyTriggerPopup.show
    this._now =
      params.now ??
      ((): Date => {
        return new Date()
      })
    this._runLogRepo = params.runLogRepo
    this._settingsRepo = params.settingsRepo
    this._staleSkipMs = params.staleSkipMs ?? sharedConstant.scheduleTrigger.staleSkip.defaultMs
  }

  async runTrigger(params: {
    source: ScheduleTriggerRunSourceMapper
    triggerId: string
  }): Promise<{ exitCode: number }> {
    const eventId = this._createEventId()

    try {
      const settings = await this._settingsRepo.load()
      const trigger = settings.triggers.find((candidate) => {
        return candidate.id === params.triggerId
      })

      if (trigger !== undefined) {
        return await this._runCommandTrigger({ eventId, settings, source: params.source, trigger })
      }

      const dummyTracker = settings.trackers.find((candidate): candidate is DummyTrackerConfig => {
        return candidate.providerId === ProviderIdMapper.DUMMY && candidate.id === params.triggerId
      })

      if (dummyTracker !== undefined) {
        return await this._runDummyTracker({ eventId, settings, source: params.source, tracker: dummyTracker })
      }

      return await this._resolveSkipOutcome({
        eventId,
        skipReason: ScheduleTriggerRunSkipReasonMapper.NOT_FOUND,
        slot: '',
        source: params.source,
        triggerId: params.triggerId,
        triggerName: '',
      })
    } catch (error) {
      await this._appendEntry({
        entry: this._createEntry({
          durationMs: 0,
          eventId,
          exitCode: 1,
          outputSnippet: `usage-pulse worker failed: ${errorUtil.resolveMessage(error)}`,
          phase: ScheduleTriggerRunPhaseMapper.FINISHED,
          skipReason: '',
          slot: '',
          source: params.source,
          triggerId: params.triggerId,
          triggerName: '',
        }),
      })

      return { exitCode: 1 }
    }
  }

  protected async _runCommandTrigger(params: {
    eventId: string
    settings: AppSettings
    source: ScheduleTriggerRunSourceMapper
    trigger: ScheduleTriggerConfig
  }): Promise<{ exitCode: number }> {
    const guardOutcome = await this._resolveGuardSkipOutcome({
      days: params.trigger.days,
      eventId: params.eventId,
      isDisabled: !params.trigger.isEnabled,
      isSchedulingEnabled: params.settings.isSchedulingEnabled,
      source: params.source,
      times: params.trigger.times,
      triggerId: params.trigger.id,
      triggerName: params.trigger.name,
    })

    if (guardOutcome !== undefined) {
      return guardOutcome
    }

    const nearestSlot = this._resolveNearestSlot({ times: params.trigger.times })

    await this._appendEntry({
      entry: this._createEntry({
        durationMs: 0,
        eventId: params.eventId,
        exitCode: -1,
        outputSnippet: '',
        phase: ScheduleTriggerRunPhaseMapper.STARTED,
        skipReason: '',
        slot: nearestSlot.slot,
        source: params.source,
        triggerId: params.trigger.id,
        triggerName: params.trigger.name,
      }),
    })

    const result = await this._commandService.run({
      command: params.trigger.command,
      timeoutMs: params.trigger.timeoutMs,
    })

    await this._appendEntry({
      entry: this._createEntry({
        durationMs: result.durationMs,
        eventId: params.eventId,
        exitCode: result.exitCode,
        outputSnippet: result.output,
        phase: ScheduleTriggerRunPhaseMapper.FINISHED,
        skipReason: '',
        slot: nearestSlot.slot,
        source: params.source,
        triggerId: params.trigger.id,
        triggerName: params.trigger.name,
      }),
    })

    return { exitCode: result.exitCode }
  }

  protected async _runDummyTracker(params: {
    eventId: string
    settings: AppSettings
    source: ScheduleTriggerRunSourceMapper
    tracker: DummyTrackerConfig
  }): Promise<{ exitCode: number }> {
    const guardOutcome = await this._resolveGuardSkipOutcome({
      days: params.tracker.days,
      eventId: params.eventId,
      isDisabled: params.tracker.isAutoRefreshPaused,
      isSchedulingEnabled: params.settings.isSchedulingEnabled,
      source: params.source,
      times: params.tracker.times,
      triggerId: params.tracker.id,
      triggerName: params.tracker.name,
    })

    if (guardOutcome !== undefined) {
      return guardOutcome
    }

    const nearestSlot = this._resolveNearestSlot({ times: params.tracker.times })
    const startedAtMs = this._now().getTime()

    await this._appendEntry({
      entry: this._createEntry({
        durationMs: 0,
        eventId: params.eventId,
        exitCode: -1,
        outputSnippet: '',
        phase: ScheduleTriggerRunPhaseMapper.STARTED,
        skipReason: '',
        slot: nearestSlot.slot,
        source: params.source,
        triggerId: params.tracker.id,
        triggerName: params.tracker.name,
      }),
    })

    await this._dummyAction({ trackerName: params.tracker.name })

    await this._appendEntry({
      entry: this._createEntry({
        durationMs: this._now().getTime() - startedAtMs,
        eventId: params.eventId,
        exitCode: 0,
        outputSnippet: 'dummy popup shown',
        phase: ScheduleTriggerRunPhaseMapper.FINISHED,
        skipReason: '',
        slot: nearestSlot.slot,
        source: params.source,
        triggerId: params.tracker.id,
        triggerName: params.tracker.name,
      }),
    })

    return { exitCode: 0 }
  }

  protected async _resolveGuardSkipOutcome(params: {
    days: ScheduleTriggerDayMapper[]
    eventId: string
    isDisabled: boolean
    isSchedulingEnabled: boolean
    source: ScheduleTriggerRunSourceMapper
    times: string[]
    triggerId: string
    triggerName: string
  }): Promise<{ exitCode: number } | undefined> {
    if (!params.isSchedulingEnabled || params.isDisabled) {
      return await this._resolveSkipOutcome({
        eventId: params.eventId,
        skipReason: ScheduleTriggerRunSkipReasonMapper.DISABLED,
        slot: this._resolveNearestSlot({ times: params.times }).slot,
        source: params.source,
        triggerId: params.triggerId,
        triggerName: params.triggerName,
      })
    }

    const weekdayIndex = this._now().getDay()
    const todayTriggerDay = this._triggerDayByWeekdayIndex[weekdayIndex]

    if (todayTriggerDay === undefined || !params.days.includes(todayTriggerDay)) {
      return await this._resolveSkipOutcome({
        eventId: params.eventId,
        skipReason: ScheduleTriggerRunSkipReasonMapper.NOT_SCHEDULED_DAY,
        slot: this._resolveNearestSlot({ times: params.times }).slot,
        source: params.source,
        triggerId: params.triggerId,
        triggerName: params.triggerName,
      })
    }

    const nearestSlot = this._resolveNearestSlot({ times: params.times })

    if (nearestSlot.diffMinutes * 60_000 > this._staleSkipMs) {
      return await this._resolveSkipOutcome({
        eventId: params.eventId,
        skipReason: ScheduleTriggerRunSkipReasonMapper.STALE,
        slot: nearestSlot.slot,
        source: params.source,
        triggerId: params.triggerId,
        triggerName: params.triggerName,
      })
    }

    return undefined
  }

  protected async _appendEntry(params: { entry: ScheduleTriggerRunLogEntry }): Promise<void> {
    await this._runLogRepo.append({ entry: params.entry }).catch(() => {
      return undefined
    })
  }

  protected _createEntry(params: {
    durationMs: number
    eventId: string
    exitCode: number
    outputSnippet: string
    phase: ScheduleTriggerRunPhaseMapper
    skipReason: ScheduleTriggerRunSkipReasonMapper | ''
    slot: string
    source: ScheduleTriggerRunSourceMapper
    triggerId: string
    triggerName: string
  }): ScheduleTriggerRunLogEntry {
    return {
      durationMs: params.durationMs,
      eventId: params.eventId,
      exitCode: params.exitCode,
      outputSnippet: params.outputSnippet,
      phase: params.phase,
      skipReason: params.skipReason,
      slot: params.slot,
      timestamp: this._now().toISOString(),
      trigger: params.source,
      triggerId: params.triggerId,
      triggerName: params.triggerName,
    }
  }

  protected _createEventId(): string {
    return `evt_${randomUUID()}`
  }

  protected _parseSlotMinutes(params: { time: string }): number {
    const match = constant.twoDigitTimeRegex.exec(params.time)
    const hoursText = match?.[1]
    const minutesText = match?.[2]

    if (hoursText === undefined || minutesText === undefined) {
      return 0
    }

    return Number.parseInt(hoursText, 10) * 60 + Number.parseInt(minutesText, 10)
  }

  protected _resolveNearestSlot(params: { times: string[] }): { diffMinutes: number; slot: string } {
    const nowMinutes = this._now().getHours() * 60 + this._now().getMinutes()

    return params.times.reduce<{ diffMinutes: number; slot: string }>(
      (nearest, time) => {
        const diffMinutes = Math.abs(nowMinutes - this._parseSlotMinutes({ time }))

        if (diffMinutes < nearest.diffMinutes) {
          return { diffMinutes, slot: time }
        }

        return nearest
      },
      { diffMinutes: Number.MAX_SAFE_INTEGER, slot: '' },
    )
  }

  protected async _resolveSkipOutcome(params: {
    eventId: string
    skipReason: ScheduleTriggerRunSkipReasonMapper
    slot: string
    source: ScheduleTriggerRunSourceMapper
    triggerId: string
    triggerName: string
  }): Promise<{ exitCode: number }> {
    await this._appendEntry({
      entry: this._createEntry({
        durationMs: 0,
        eventId: params.eventId,
        exitCode: 0,
        outputSnippet: '',
        phase: ScheduleTriggerRunPhaseMapper.SKIPPED,
        skipReason: params.skipReason,
        slot: params.slot,
        source: params.source,
        triggerId: params.triggerId,
        triggerName: params.triggerName,
      }),
    })

    return { exitCode: 0 }
  }
}
