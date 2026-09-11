import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { type ScheduleTriggerRunLogEntry } from '#src/shared/business/model/schedule-trigger-model'
import { constant } from '#src/shared/util/constant'

export class TriggerRunLogRepo {
  protected readonly _logFilePath: string
  protected readonly _readEntryLimit: number
  protected readonly _rotateKeepLineCount: number
  protected readonly _rotateMaxBytes: number

  constructor(params: {
    logFilePath: string
    readEntryLimit?: number
    rotateKeepLineCount?: number
    rotateMaxBytes?: number
  }) {
    this._logFilePath = params.logFilePath
    this._readEntryLimit = params.readEntryLimit ?? constant.scheduleTrigger.run.log.readEntryLimit
    this._rotateKeepLineCount = params.rotateKeepLineCount ?? constant.scheduleTrigger.run.log.rotateKeepLineCount
    this._rotateMaxBytes = params.rotateMaxBytes ?? constant.scheduleTrigger.run.log.rotateMaxBytes
  }

  async append(params: { entry: ScheduleTriggerRunLogEntry }): Promise<void> {
    await mkdir(dirname(this._logFilePath), { recursive: true })
    await appendFile(this._logFilePath, `${JSON.stringify(params.entry)}\n`, 'utf8')
    await this._rotateIfNeeded()
  }

  async listByTriggerId(params: { triggerId: string }): Promise<ScheduleTriggerRunLogEntry[]> {
    const entries = await this._readEntries()

    return entries
      .filter((entry) => {
        return entry.triggerId === params.triggerId
      })
      .slice(-this._readEntryLimit)
  }

  async removeByTriggerId(params: { triggerId: string }): Promise<void> {
    const content = await this._readFileContent()
    const keptLines = content
      .split('\n')
      .filter((line) => {
        return line.trim() !== ''
      })
      .filter((line) => {
        return this._resolveEntryTriggerId({ line }) !== params.triggerId
      })

    await mkdir(dirname(this._logFilePath), { recursive: true })
    await writeFile(this._logFilePath, this._resolveLinesContent({ lines: keptLines }), 'utf8')
  }

  protected _parseEntry(params: { line: string }): ScheduleTriggerRunLogEntry[] {
    if (params.line.trim() === '') {
      return []
    }

    try {
      return [JSON.parse(params.line) as ScheduleTriggerRunLogEntry]
    } catch {
      return []
    }
  }

  protected async _readEntries(): Promise<ScheduleTriggerRunLogEntry[]> {
    const fileContent = await this._readFileContent()

    return fileContent.split('\n').reduce<ScheduleTriggerRunLogEntry[]>((entries, line) => {
      return [...entries, ...this._parseEntry({ line })]
    }, [])
  }

  protected async _readFileContent(): Promise<string> {
    try {
      return await readFile(this._logFilePath, 'utf8')
    } catch {
      return ''
    }
  }

  protected _resolveEntryTriggerId(params: { line: string }): string | undefined {
    const [entry] = this._parseEntry({ line: params.line })

    return entry?.triggerId
  }

  protected _resolveLinesContent(params: { lines: string[] }): string {
    if (params.lines.length === 0) {
      return ''
    }

    return `${params.lines.join('\n')}\n`
  }

  protected async _resolveFileSize(): Promise<number | undefined> {
    try {
      const fileInfo = await stat(this._logFilePath)

      return fileInfo.size
    } catch {
      return undefined
    }
  }

  protected async _rotateIfNeeded(): Promise<void> {
    const fileSize = await this._resolveFileSize()

    if (fileSize === undefined || fileSize <= this._rotateMaxBytes) {
      return
    }

    const content = await readFile(this._logFilePath, 'utf8')
    const keptLines = content
      .split('\n')
      .filter((line) => {
        return line.trim() !== ''
      })
      .slice(-this._rotateKeepLineCount)

    await writeFile(this._logFilePath, `${keptLines.join('\n')}\n`, 'utf8')
  }
}
