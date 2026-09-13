import { app } from 'electron'
import { join } from 'node:path'

import { type ITriggerRunLogDal } from '#src/main/business/repo/trigger-run-log-repo-singleton'
import { FileDal } from '#src/main/dal/file-dal'
import { type ScheduleTriggerRunLogEntry } from '#src/shared/business/model/schedule-trigger-model'
import { constant } from '#src/shared/util/constant'

export class TriggerRunLogDal extends FileDal implements ITriggerRunLogDal {
  protected readonly _logFilePath: string
  protected readonly _rotateKeepLineCount: number
  protected readonly _rotateMaxBytes: number

  constructor(params?: { logFilePath?: string; rotateKeepLineCount?: number; rotateMaxBytes?: number }) {
    super()
    const {
      logFilePath = join(app.getPath('userData'), 'usage-pulse-trigger-log.jsonl'),
      rotateKeepLineCount,
      rotateMaxBytes,
    } = params ?? {}
    this._logFilePath = logFilePath
    this._rotateKeepLineCount = rotateKeepLineCount ?? constant.scheduleTrigger.run.log.rotateKeepLineCount
    this._rotateMaxBytes = rotateMaxBytes ?? constant.scheduleTrigger.run.log.rotateMaxBytes
  }

  async appendLogEntry(params: { entry: ScheduleTriggerRunLogEntry }): Promise<void> {
    const { entry } = params
    await this._appendTextFile({ content: `${JSON.stringify(entry)}\n`, filePath: this._logFilePath })
    await this._rotateIfNeeded()
  }

  async readLogEntries(): Promise<ScheduleTriggerRunLogEntry[]> {
    const content = await this._readLogContent()

    return content.split('\n').reduce<ScheduleTriggerRunLogEntry[]>((entries, line) => {
      return [...entries, ...this._parseEntry({ line })]
    }, [])
  }

  async writeLogEntries(params: { entries: ScheduleTriggerRunLogEntry[] }): Promise<void> {
    const { entries } = params
    await this._writeTextFile({ content: this._resolveEntriesContent({ entries }), filePath: this._logFilePath })
  }

  protected _parseEntry(params: { line: string }): ScheduleTriggerRunLogEntry[] {
    const { line } = params
    if (line.trim() === '') {
      return []
    }

    try {
      return [JSON.parse(line) as ScheduleTriggerRunLogEntry]
    } catch {
      return []
    }
  }

  protected async _readLogContent(): Promise<string> {
    try {
      return (await this._readTextFile({ filePath: this._logFilePath })) ?? ''
    } catch {
      return ''
    }
  }

  protected _resolveEntriesContent(params: { entries: ScheduleTriggerRunLogEntry[] }): string {
    const { entries } = params
    if (entries.length === 0) {
      return ''
    }

    return `${entries
      .map((entry) => {
        return JSON.stringify(entry)
      })
      .join('\n')}\n`
  }

  protected async _rotateIfNeeded(): Promise<void> {
    const fileSize = await this._resolveFileSize({ filePath: this._logFilePath })

    if (fileSize === undefined || fileSize <= this._rotateMaxBytes) {
      return
    }

    const content = (await this._readTextFile({ filePath: this._logFilePath })) ?? ''
    const keptLines = content
      .split('\n')
      .filter((line) => {
        return line.trim() !== ''
      })
      .slice(-this._rotateKeepLineCount)

    await this._writeTextFile({ content: `${keptLines.join('\n')}\n`, filePath: this._logFilePath })
  }
}
