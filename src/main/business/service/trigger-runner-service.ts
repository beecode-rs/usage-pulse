import { randomUUID } from 'node:crypto'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { triggerRunLogRepoSingleton } from '#src/main/business/repo/trigger-run-log-repo-singleton'
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
  protected readonly _commandService = new TriggerCommandService()
  protected readonly _dummyAction: DummyTrackerAction = dummyTriggerPopup.show
  protected readonly _runLogRepo = triggerRunLogRepoSingleton()
  protected readonly _settingsRepo = settingsRepoSingleton()
  protected readonly _staleSkipMs = sharedConstant.scheduleTrigger.staleSkip.defaultMs
  protected readonly _triggerDayByWeekdayIndex: readonly ScheduleTriggerDayMapper[] = [
    ScheduleTriggerDayMapper.SUNDAY,
    ScheduleTriggerDayMapper.MONDAY,
    ScheduleTriggerDayMapper.TUESDAY,
    ScheduleTriggerDayMapper.WEDNESDAY,
    ScheduleTriggerDayMapper.THURSDAY,
    ScheduleTriggerDayMapper.FRIDAY,
    ScheduleTriggerDayMapper.SATURDAY,
  ]

  async runTrigger(params: {
    source: ScheduleTriggerRunSourceMapper
    triggerId: string
  }): Promise<{ exitCode: number }> {
    const { source, triggerId } = params
    const eventId = this._createEventId()

    try {
      const settings = await this._settingsRepo.load()
      const trigger = settings.triggers.find((candidate) => {
        return candidate.id === triggerId
      })

      if (trigger !== undefined) {
        return await this._runCommandTrigger({ eventId, settings, source, trigger })
      }

      const dummyTracker = settings.trackers.find((candidate): candidate is DummyTrackerConfig => {
        return candidate.providerId === ProviderIdMapper.DUMMY && candidate.id === triggerId
      })

      if (dummyTracker !== undefined) {
        return await this._runDummyTracker({ eventId, settings, source, tracker: dummyTracker })
      }

      return await this._resolveSkipOutcome({
        eventId,
        skipReason: ScheduleTriggerRunSkipReasonMapper.NOT_FOUND,
        slot: '',
        source,
        triggerId,
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
          source,
          triggerId,
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
    const { eventId, settings, source, trigger } = params
    const guardOutcome = await this._resolveGuardSkipOutcome({
      days: trigger.days,
      eventId,
      isDisabled: !trigger.isEnabled,
      isSchedulingEnabled: settings.isSchedulingEnabled,
      source,
      times: trigger.times,
      triggerId: trigger.id,
      triggerName: trigger.name,
    })

    if (guardOutcome !== undefined) {
      return guardOutcome
    }

    const nearestSlot = this._resolveNearestSlot({ times: trigger.times })

    await this._appendEntry({
      entry: this._createEntry({
        durationMs: 0,
        eventId,
        exitCode: -1,
        outputSnippet: '',
        phase: ScheduleTriggerRunPhaseMapper.STARTED,
        skipReason: '',
        slot: nearestSlot.slot,
        source,
        triggerId: trigger.id,
        triggerName: trigger.name,
      }),
    })

    const result = await this._commandService.run({
      command: trigger.command,
      timeoutMs: trigger.timeoutMs,
    })

    await this._appendEntry({
      entry: this._createEntry({
        durationMs: result.durationMs,
        eventId,
        exitCode: result.exitCode,
        outputSnippet: result.output,
        phase: ScheduleTriggerRunPhaseMapper.FINISHED,
        skipReason: '',
        slot: nearestSlot.slot,
        source,
        triggerId: trigger.id,
        triggerName: trigger.name,
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
    const { eventId, settings, source, tracker } = params
    const guardOutcome = await this._resolveGuardSkipOutcome({
      days: tracker.days,
      eventId,
      isDisabled: tracker.isAutoRefreshPaused,
      isSchedulingEnabled: settings.isSchedulingEnabled,
      source,
      times: tracker.times,
      triggerId: tracker.id,
      triggerName: tracker.name,
    })

    if (guardOutcome !== undefined) {
      return guardOutcome
    }

    const nearestSlot = this._resolveNearestSlot({ times: tracker.times })
    const startedAtMs = this._now().getTime()

    await this._appendEntry({
      entry: this._createEntry({
        durationMs: 0,
        eventId,
        exitCode: -1,
        outputSnippet: '',
        phase: ScheduleTriggerRunPhaseMapper.STARTED,
        skipReason: '',
        slot: nearestSlot.slot,
        source,
        triggerId: tracker.id,
        triggerName: tracker.name,
      }),
    })

    await this._dummyAction({ trackerName: tracker.name })

    await this._appendEntry({
      entry: this._createEntry({
        durationMs: this._now().getTime() - startedAtMs,
        eventId,
        exitCode: 0,
        outputSnippet: 'dummy popup shown',
        phase: ScheduleTriggerRunPhaseMapper.FINISHED,
        skipReason: '',
        slot: nearestSlot.slot,
        source,
        triggerId: tracker.id,
        triggerName: tracker.name,
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
    const { days, eventId, isDisabled, isSchedulingEnabled, source, times, triggerId, triggerName } = params
    if (!isSchedulingEnabled || isDisabled) {
      return await this._resolveSkipOutcome({
        eventId,
        skipReason: ScheduleTriggerRunSkipReasonMapper.DISABLED,
        slot: this._resolveNearestSlot({ times }).slot,
        source,
        triggerId,
        triggerName,
      })
    }

    const weekdayIndex = this._now().getDay()
    const todayTriggerDay = this._triggerDayByWeekdayIndex[weekdayIndex]

    if (todayTriggerDay === undefined || !days.includes(todayTriggerDay)) {
      return await this._resolveSkipOutcome({
        eventId,
        skipReason: ScheduleTriggerRunSkipReasonMapper.NOT_SCHEDULED_DAY,
        slot: this._resolveNearestSlot({ times }).slot,
        source,
        triggerId,
        triggerName,
      })
    }

    const nearestSlot = this._resolveNearestSlot({ times })

    if (nearestSlot.diffMinutes * 60_000 > this._staleSkipMs) {
      return await this._resolveSkipOutcome({
        eventId,
        skipReason: ScheduleTriggerRunSkipReasonMapper.STALE,
        slot: nearestSlot.slot,
        source,
        triggerId,
        triggerName,
      })
    }

    return undefined
  }

  protected async _appendEntry(params: { entry: ScheduleTriggerRunLogEntry }): Promise<void> {
    const { entry } = params
    await this._runLogRepo.append({ entry }).catch(() => {
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
    const { durationMs, eventId, exitCode, outputSnippet, phase, skipReason, slot, source, triggerId, triggerName } =
      params

    return {
      durationMs,
      eventId,
      exitCode,
      outputSnippet,
      phase,
      skipReason,
      slot,
      timestamp: this._now().toISOString(),
      trigger: source,
      triggerId,
      triggerName,
    }
  }

  protected _createEventId(): string {
    return `evt_${randomUUID()}`
  }

  protected _now(): Date {
    return new Date()
  }

  protected _parseSlotMinutes(params: { time: string }): number {
    const { time } = params
    const match = constant.twoDigitTimeRegex.exec(time)
    const hoursText = match?.[1]
    const minutesText = match?.[2]

    if (hoursText === undefined || minutesText === undefined) {
      return 0
    }

    return Number.parseInt(hoursText, 10) * 60 + Number.parseInt(minutesText, 10)
  }

  protected _resolveNearestSlot(params: { times: string[] }): { diffMinutes: number; slot: string } {
    const { times } = params
    const nowMinutes = this._now().getHours() * 60 + this._now().getMinutes()

    return times.reduce<{ diffMinutes: number; slot: string }>(
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
    const { eventId, skipReason, slot, source, triggerId, triggerName } = params
    await this._appendEntry({
      entry: this._createEntry({
        durationMs: 0,
        eventId,
        exitCode: 0,
        outputSnippet: '',
        phase: ScheduleTriggerRunPhaseMapper.SKIPPED,
        skipReason,
        slot,
        source,
        triggerId,
        triggerName,
      }),
    })

    return { exitCode: 0 }
  }
}
