import { ScheduleTriggerRunPhaseMapper } from '#src/shared/business/enum/schedule-trigger-run-phase-mapper-enum'
import type { ScheduleTriggerRunSkipReasonMapper } from '#src/shared/business/enum/schedule-trigger-run-skip-reason-mapper-enum'
import type { ScheduleTriggerRunSourceMapper } from '#src/shared/business/enum/schedule-trigger-run-source-mapper-enum'
import { type ScheduleTriggerRunLogEntry } from '#src/shared/business/model/schedule-trigger-model'

export type TriggerRunSummary = {
  durationMs: number
  eventId: string
  exitCode: number
  outputSnippet: string
  phase: ScheduleTriggerRunPhaseMapper
  skipReason: ScheduleTriggerRunSkipReasonMapper | ''
  slot: string
  startedAtTimestamp: string
  trigger: ScheduleTriggerRunSourceMapper
  triggerName: string
}

export class TriggerRunUtil {
  groupRunsByEventId(params: { entries: ScheduleTriggerRunLogEntry[] }): TriggerRunSummary[] {
    const summaryByEventId = params.entries.reduce<Record<string, TriggerRunSummary>>((summaryRecord, entry) => {
      return {
        ...summaryRecord,
        [entry.eventId]: this._mergeEntry({
          entry,
          summary: summaryRecord[entry.eventId],
        }),
      }
    }, {})

    return Object.values(summaryByEventId).sort((summary, nextSummary) => {
      return nextSummary.startedAtTimestamp.localeCompare(summary.startedAtTimestamp)
    })
  }

  protected _applyTerminalEntry(params: {
    entry: ScheduleTriggerRunLogEntry
    summary: TriggerRunSummary
  }): TriggerRunSummary {
    return {
      ...params.summary,
      durationMs: params.entry.durationMs,
      exitCode: params.entry.exitCode,
      outputSnippet: params.entry.outputSnippet,
      phase: params.entry.phase,
      skipReason: params.entry.skipReason,
    }
  }

  protected _createSummaryFromEntry(params: { entry: ScheduleTriggerRunLogEntry }): TriggerRunSummary {
    return {
      durationMs: params.entry.durationMs,
      eventId: params.entry.eventId,
      exitCode: params.entry.exitCode,
      outputSnippet: params.entry.outputSnippet,
      phase: params.entry.phase,
      skipReason: params.entry.skipReason,
      slot: params.entry.slot,
      startedAtTimestamp: params.entry.timestamp,
      trigger: params.entry.trigger,
      triggerName: params.entry.triggerName,
    }
  }

  protected _mergeEntry(params: {
    entry: ScheduleTriggerRunLogEntry
    summary: TriggerRunSummary | undefined
  }): TriggerRunSummary {
    if (params.summary === undefined) {
      return this._createSummaryFromEntry({ entry: params.entry })
    }

    if (params.entry.phase === ScheduleTriggerRunPhaseMapper.STARTED) {
      return { ...params.summary, startedAtTimestamp: params.entry.timestamp }
    }

    return this._applyTerminalEntry({ entry: params.entry, summary: params.summary })
  }
}
