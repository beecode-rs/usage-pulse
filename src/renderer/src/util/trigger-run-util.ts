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
    const { entries } = params
    const summaryByEventId = entries.reduce<Record<string, TriggerRunSummary>>((summaryRecord, entry) => {
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
    const { entry, summary } = params

    return {
      ...summary,
      durationMs: entry.durationMs,
      exitCode: entry.exitCode,
      outputSnippet: entry.outputSnippet,
      phase: entry.phase,
      skipReason: entry.skipReason,
    }
  }

  protected _createSummaryFromEntry(params: { entry: ScheduleTriggerRunLogEntry }): TriggerRunSummary {
    const { entry } = params

    return {
      durationMs: entry.durationMs,
      eventId: entry.eventId,
      exitCode: entry.exitCode,
      outputSnippet: entry.outputSnippet,
      phase: entry.phase,
      skipReason: entry.skipReason,
      slot: entry.slot,
      startedAtTimestamp: entry.timestamp,
      trigger: entry.trigger,
      triggerName: entry.triggerName,
    }
  }

  protected _mergeEntry(params: {
    entry: ScheduleTriggerRunLogEntry
    summary: TriggerRunSummary | undefined
  }): TriggerRunSummary {
    const { entry, summary } = params
    if (summary === undefined) {
      return this._createSummaryFromEntry({ entry })
    }

    if (entry.phase === ScheduleTriggerRunPhaseMapper.STARTED) {
      return { ...summary, startedAtTimestamp: entry.timestamp }
    }

    return this._applyTerminalEntry({ entry, summary })
  }
}
