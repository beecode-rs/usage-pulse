import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { TriggerRunLogRepo } from '#src/main/business/repo/trigger-run-log-repo'
import { type ScheduleTriggerRunLogEntry } from '#src/shared/business/model/schedule-trigger-model'

type LogLine = ScheduleTriggerRunLogEntry | string

const resolveTempLogFilePath = (): string => {
  return join(mkdtempSync(join(tmpdir(), 'trigger-run-log-repo-')), 'usage-pulse-trigger-log.jsonl')
}

const appendEntriesSequentially = async (params: {
  entries: ScheduleTriggerRunLogEntry[]
  repo: TriggerRunLogRepo
}): Promise<void> => {
  const { entries, repo } = params
  await entries.reduce(async (previous, entry) => {
    await previous
    await repo.append({ entry })
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

const createRepoOnRawLines = (params: { lines: LogLine[]; readEntryLimit?: number }): TriggerRunLogRepo => {
  const { lines, readEntryLimit } = params
  const logFilePath = resolveTempLogFilePath()
  writeFileSync(logFilePath, resolveLinesContent({ lines }), 'utf8')

  return new TriggerRunLogRepo({ logFilePath, readEntryLimit })
}

export const triggerRunLogRepoContractHarness = {
  listAfterAppend: async (params: {
    entries: ScheduleTriggerRunLogEntry[]
    triggerId: string
  }): Promise<ScheduleTriggerRunLogEntry[]> => {
    const { entries, triggerId } = params
    const repo = new TriggerRunLogRepo({ logFilePath: resolveTempLogFilePath() })
    await appendEntriesSequentially({ entries, repo })

    return await repo.listByTriggerId({ triggerId })
  },
  listAfterLimitTruncation: async (params: {
    entries: ScheduleTriggerRunLogEntry[]
    readEntryLimit: number
    triggerId: string
  }): Promise<ScheduleTriggerRunLogEntry[]> => {
    const { entries, readEntryLimit, triggerId } = params

    return await createRepoOnRawLines({ lines: entries, readEntryLimit }).listByTriggerId({ triggerId })
  },
  listOnMissingFile: async (params: { triggerId: string }): Promise<ScheduleTriggerRunLogEntry[]> => {
    const { triggerId } = params

    return await new TriggerRunLogRepo({ logFilePath: resolveTempLogFilePath() }).listByTriggerId({ triggerId })
  },
  listOnRawLines: async (params: { lines: LogLine[]; triggerId: string }): Promise<ScheduleTriggerRunLogEntry[]> => {
    const { lines, triggerId } = params

    return await createRepoOnRawLines({ lines }).listByTriggerId({ triggerId })
  },
  removeOnMissingFile: async (params: { triggerId: string }): Promise<ScheduleTriggerRunLogEntry[]> => {
    const { triggerId } = params
    const repo = new TriggerRunLogRepo({ logFilePath: resolveTempLogFilePath() })
    await repo.removeByTriggerId({ triggerId })

    return await repo.listByTriggerId({ triggerId })
  },
  removeOnRawLines: async (params: {
    lines: LogLine[]
    remainingTriggerId: string
    removeTriggerId: string
  }): Promise<ScheduleTriggerRunLogEntry[]> => {
    const { lines, remainingTriggerId, removeTriggerId } = params
    const repo = createRepoOnRawLines({ lines })
    await repo.removeByTriggerId({ triggerId: removeTriggerId })

    return await repo.listByTriggerId({ triggerId: remainingTriggerId })
  },
}
