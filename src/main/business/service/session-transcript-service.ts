import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { claudeTranscriptParserService } from '#src/main/lib/claude-transcript-parser/service'
import { type ISessionInfo, type ISessionTranscriptStats } from '#src/shared/session-model'

const CACHE_ENTRY_LIMIT = 500

interface ITranscriptCacheEntry {
  mtimeMs: number
  transcript: ISessionTranscriptStats | undefined
}

export class SessionTranscriptService {
  protected readonly _cacheByPath = new Map<string, ITranscriptCacheEntry>()
  protected readonly _homeDir: string

  constructor(params: { homeDir?: string } = {}) {
    this._homeDir = params.homeDir ?? homedir()
  }

  async enrichSessions(params: { sessions: ISessionInfo[] }): Promise<ISessionInfo[]> {
    return Promise.all(
      params.sessions.map((session) => {
        return this._enrichSession({ session })
      }),
    )
  }

  protected async _enrichSession(params: { session: ISessionInfo }): Promise<ISessionInfo> {
    if (params.session.hostId !== undefined) {
      return params.session
    }

    const transcript = await this._resolveTranscript({
      cwd: params.session.cwd,
      sessionId: params.session.sessionId,
    })

    if (transcript === undefined) {
      return params.session
    }

    return { ...params.session, transcript }
  }

  protected _resolveDisplayableTranscript(params: {
    stats: ISessionTranscriptStats
  }): ISessionTranscriptStats | undefined {
    if (claudeTranscriptParserService.hasSignal(params.stats)) {
      return params.stats
    }

    return undefined
  }

  protected _resolveTranscriptFilePath(params: { cwd: string; sessionId: string }): string {
    const projectDirName = params.cwd.replaceAll('/', '-')

    return join(this._homeDir, '.claude', 'projects', projectDirName, `${params.sessionId}.jsonl`)
  }

  protected async _resolveTranscript(params: {
    cwd: string
    sessionId: string
  }): Promise<ISessionTranscriptStats | undefined> {
    if (params.cwd === '' || params.sessionId === '') {
      return undefined
    }

    const filePath = this._resolveTranscriptFilePath({ cwd: params.cwd, sessionId: params.sessionId })

    try {
      const fileStat = await stat(filePath)
      const cachedEntry = this._cacheByPath.get(filePath)

      if (cachedEntry?.mtimeMs === fileStat.mtimeMs) {
        return cachedEntry.transcript
      }

      const content = await readFile(filePath, 'utf8')
      const parsedStats = claudeTranscriptParserService.parseStats({ content })
      const transcript = this._resolveDisplayableTranscript({ stats: parsedStats })

      this._storeCacheEntry({ filePath, mtimeMs: fileStat.mtimeMs, transcript })

      return transcript
    } catch {
      return undefined
    }
  }

  protected _storeCacheEntry(params: {
    filePath: string
    mtimeMs: number
    transcript: ISessionTranscriptStats | undefined
  }): void {
    if (this._cacheByPath.size >= CACHE_ENTRY_LIMIT) {
      this._cacheByPath.clear()
    }

    this._cacheByPath.set(params.filePath, { mtimeMs: params.mtimeMs, transcript: params.transcript })
  }
}
