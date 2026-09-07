import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { TriggerRunLogDal } from '#src/main/dal/trigger-run-log-dal'
import { type ScheduleTriggerRunLogEntry } from '#src/shared/business/model/schedule-trigger-model'

type LogLine = ScheduleTriggerRunLogEntry | string

const resolveTempLogFilePath = (): string => {
  return join(mkdtempSync(join(tmpdir(), 'trigger-run-log-dal-')), 'usage-pulse-trigger-log.jsonl')
}

const appendEntriesSequentially = async (params: {
  dal: TriggerRunLogDal
  entries: ScheduleTriggerRunLogEntry[]
}): Promise<void> => {
  const { dal, entries } = params
  await entries.reduce(async (previous, entry) => {
    await previous
    await dal.appendLogEntry({ entry })
  }, Promise.resolve())
}

const resolveLinesContent = (params: { lines: LogLine[] }): string => {
  const { lines } = params
  const serializedLines = lines.map((line) => {
    if (typeof line === 'string') {
      return line
    }

    return JSON.stringify(line)
  })

  return `${serializedLines.join('\n')}\n`
}

export const triggerRunLogDalContractHarness = {
  readEntriesAfterAppend: async (params: {
    entries: ScheduleTriggerRunLogEntry[]
  }): Promise<ScheduleTriggerRunLogEntry[]> => {
    const { entries } = params
    const dal = new TriggerRunLogDal({ logFilePath: resolveTempLogFilePath() })
    await appendEntriesSequentially({ dal, entries })

    return await dal.readLogEntries()
  },
  readEntriesAfterAppendWithRotation: async (params: {
    entries: ScheduleTriggerRunLogEntry[]
    rotateKeepLineCount: number
  }): Promise<ScheduleTriggerRunLogEntry[]> => {
    const { entries, rotateKeepLineCount } = params
    const dal = new TriggerRunLogDal({
      logFilePath: resolveTempLogFilePath(),
      rotateKeepLineCount,
      rotateMaxBytes: 1,
    })
    await appendEntriesSequentially({ dal, entries })

    return await dal.readLogEntries()
  },
  readEntriesAfterWrite: async (params: {
    entries: ScheduleTriggerRunLogEntry[]
  }): Promise<ScheduleTriggerRunLogEntry[]> => {
    const { entries } = params
    const dal = new TriggerRunLogDal({ logFilePath: resolveTempLogFilePath() })
    await dal.writeLogEntries({ entries })

    return await dal.readLogEntries()
  },
  readEntriesAfterWriteEmptyEntries: async (): Promise<ScheduleTriggerRunLogEntry[]> => {
    const dal = new TriggerRunLogDal({ logFilePath: resolveTempLogFilePath() })
    await dal.writeLogEntries({ entries: [] })

    return await dal.readLogEntries()
  },
  readEntriesOnMissingFile: async (): Promise<ScheduleTriggerRunLogEntry[]> => {
    return await new TriggerRunLogDal({ logFilePath: resolveTempLogFilePath() }).readLogEntries()
  },
  readEntriesOnRawLines: async (params: { lines: LogLine[] }): Promise<ScheduleTriggerRunLogEntry[]> => {
    const { lines } = params
    const logFilePath = resolveTempLogFilePath()
    writeFileSync(logFilePath, resolveLinesContent({ lines }), 'utf8')

    return await new TriggerRunLogDal({ logFilePath }).readLogEntries()
  },
}
