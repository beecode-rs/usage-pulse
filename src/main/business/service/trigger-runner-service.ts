import { randomUUID } from 'node:crypto'

import { type SettingsRepo } from '#src/main/business/repo/settings-repo'
import { type TriggerRunLogRepo } from '#src/main/business/repo/trigger-run-log-repo'
import { TriggerCommandService } from '#src/main/business/service/trigger-command-service'
import { dummyTriggerPopup } from '#src/main/lib/dummy-trigger-popup'
import { constant } from '#src/main/util/constant'
import { errorUtil } from '#src/main/util/error-util'
import { type IAppSettings, type IDummyTrackerConfig } from '#src/shared/settings-model'
import {
  DEFAULT_TRIGGER_STALE_SKIP_MINUTES,
  type ITriggerConfig,
  type ITriggerRunLogEntry,
  type TriggerDay,
  type TriggerRunPhase,
  type TriggerRunSkipReason,
  type TriggerRunSource,
} from '#src/shared/trigger-model'

export type DummyTrackerAction = (params: { trackerName: string }) => Promise<void>

export class TriggerRunnerService {
  protected readonly _commandService: TriggerCommandService
  protected readonly _dummyAction: DummyTrackerAction
  protected readonly _now: () => Date
  protected readonly _runLogRepo: TriggerRunLogRepo
  protected readonly _settingsRepo: SettingsRepo
  protected readonly _staleSkipMinutes: number
  protected readonly _triggerDayByWeekdayIndex: readonly TriggerDay[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]

  constructor(params: {
    commandService?: TriggerCommandService
    dummyAction?: DummyTrackerAction
    now?: () => Date
    runLogRepo: TriggerRunLogRepo
    settingsRepo: SettingsRepo
    staleSkipMinutes?: number
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
    this._staleSkipMinutes = params.staleSkipMinutes ?? DEFAULT_TRIGGER_STALE_SKIP_MINUTES
  }

  async runTrigger(params: { source: TriggerRunSource; triggerId: string }): Promise<{ exitCode: number }> {
    const eventId = this._createEventId()

    try {
      const settings = await this._settingsRepo.load()
      const trigger = settings.triggers.find((candidate) => {
        return candidate.id === params.triggerId
      })

      if (trigger !== undefined) {
        return await this._runCommandTrigger({ eventId, settings, source: params.source, trigger })
      }

      const dummyTracker = settings.trackers.find((candidate): candidate is IDummyTrackerConfig => {
        return candidate.providerId === 'dummy' && candidate.id === params.triggerId
      })

      if (dummyTracker !== undefined) {
        return await this._runDummyTracker({ eventId, settings, source: params.source, tracker: dummyTracker })
      }

      return await this._resolveSkipOutcome({
        eventId,
        skipReason: 'not-found',
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
          phase: 'finished',
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
    settings: IAppSettings
    source: TriggerRunSource
    trigger: ITriggerConfig
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
        phase: 'started',
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
        phase: 'finished',
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
    settings: IAppSettings
    source: TriggerRunSource
    tracker: IDummyTrackerConfig
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
        phase: 'started',
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
        phase: 'finished',
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
    days: TriggerDay[]
    eventId: string
    isDisabled: boolean
    isSchedulingEnabled: boolean
    source: TriggerRunSource
    times: string[]
    triggerId: string
    triggerName: string
  }): Promise<{ exitCode: number } | undefined> {
    if (!params.isSchedulingEnabled || params.isDisabled) {
      return await this._resolveSkipOutcome({
        eventId: params.eventId,
        skipReason: 'disabled',
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
        skipReason: 'not-scheduled-day',
        slot: this._resolveNearestSlot({ times: params.times }).slot,
        source: params.source,
        triggerId: params.triggerId,
        triggerName: params.triggerName,
      })
    }

    const nearestSlot = this._resolveNearestSlot({ times: params.times })

    if (nearestSlot.diffMinutes > this._staleSkipMinutes) {
      return await this._resolveSkipOutcome({
        eventId: params.eventId,
        skipReason: 'stale',
        slot: nearestSlot.slot,
        source: params.source,
        triggerId: params.triggerId,
        triggerName: params.triggerName,
      })
    }

    return undefined
  }

  protected async _appendEntry(params: { entry: ITriggerRunLogEntry }): Promise<void> {
    await this._runLogRepo.append({ entry: params.entry }).catch(() => {
      return undefined
    })
  }

  protected _createEntry(params: {
    durationMs: number
    eventId: string
    exitCode: number
    outputSnippet: string
    phase: TriggerRunPhase
    skipReason: TriggerRunSkipReason | ''
    slot: string
    source: TriggerRunSource
    triggerId: string
    triggerName: string
  }): ITriggerRunLogEntry {
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
    skipReason: TriggerRunSkipReason
    slot: string
    source: TriggerRunSource
    triggerId: string
    triggerName: string
  }): Promise<{ exitCode: number }> {
    await this._appendEntry({
      entry: this._createEntry({
        durationMs: 0,
        eventId: params.eventId,
        exitCode: 0,
        outputSnippet: '',
        phase: 'skipped',
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
