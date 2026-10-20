import { z } from 'zod'

import { TriggerRunLogDal } from '#src/main/dal/trigger-run-log-dal'
import { ScheduleTriggerRunPhaseMapper } from '#src/shared/business/enum/schedule-trigger-run-phase-mapper-enum'
import { ScheduleTriggerRunSkipReasonMapper } from '#src/shared/business/enum/schedule-trigger-run-skip-reason-mapper-enum'
import { ScheduleTriggerRunSourceMapper } from '#src/shared/business/enum/schedule-trigger-run-source-mapper-enum'
import { type ScheduleTriggerRunLogEntry } from '#src/shared/business/model/schedule-trigger-model'
import { constant } from '#src/shared/util/constant'

export interface ITriggerRunLogDal {
  appendLogEntry: (params: { entry: ScheduleTriggerRunLogEntry }) => Promise<void>
  readLogLines: () => Promise<string[]>
  writeLogEntries: (params: { entries: ScheduleTriggerRunLogEntry[] }) => Promise<void>
}

const scheduleTriggerRunLogEntrySchema = z.object({
  durationMs: z.number(),
  eventId: z.string(),
  exitCode: z.number(),
  outputSnippet: z.string(),
  phase: z.enum(ScheduleTriggerRunPhaseMapper),
  skipReason: z.union([z.enum(ScheduleTriggerRunSkipReasonMapper), z.literal('')]),
  slot: z.string(),
  timestamp: z.string(),
  trigger: z.enum(ScheduleTriggerRunSourceMapper),
  triggerId: z.string(),
  triggerName: z.string(),
})

export class TriggerRunLogRepo {
  protected readonly _dal: ITriggerRunLogDal
  protected readonly _readEntryLimit: number

  constructor(params: { logFilePath?: string; readEntryLimit?: number } = {}) {
    const { logFilePath, readEntryLimit } = params
    this._dal = new TriggerRunLogDal({ logFilePath })
    this._readEntryLimit = readEntryLimit ?? constant.scheduleTrigger.run.log.readEntryLimit
  }

  async append(params: { entry: ScheduleTriggerRunLogEntry }): Promise<void> {
    const { entry } = params
    await this._dal.appendLogEntry({ entry })
  }

  async listByTriggerId(params: { triggerId: string }): Promise<ScheduleTriggerRunLogEntry[]> {
    const { triggerId } = params
    const lines = await this._dal.readLogLines()

    return this._parseLogEntries({ lines })
      .filter((entry) => {
        return entry.triggerId === triggerId
      })
      .slice(-this._readEntryLimit)
  }

  async removeByTriggerId(params: { triggerId: string }): Promise<void> {
    const { triggerId } = params
    const lines = await this._dal.readLogLines()
    const keptEntries = this._parseLogEntries({ lines }).filter((entry) => {
      return entry.triggerId !== triggerId
    })

    await this._dal.writeLogEntries({ entries: keptEntries })
  }

  protected _parseLogEntries(params: { lines: string[] }): ScheduleTriggerRunLogEntry[] {
    const { lines } = params

    return lines.reduce<ScheduleTriggerRunLogEntry[]>((entries, line) => {
      const parsedEntry = scheduleTriggerRunLogEntrySchema.safeParse(this._parseJsonLine({ line }))

      if (parsedEntry.success) {
        return [...entries, parsedEntry.data]
      }

      return entries
    }, [])
  }

  protected _parseJsonLine(params: { line: string }): unknown {
    const { line } = params
    try {
      return JSON.parse(line)
    } catch {
      return undefined
    }
  }
}
