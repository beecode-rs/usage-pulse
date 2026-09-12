import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { ClaudeTranscriptParserService } from '#src/main/lib/claude-transcript-parser/service'
import { type SessionInfo, type SessionTranscriptStats } from '#src/shared/business/model/session-model'

const CACHE_ENTRY_LIMIT = 500

type TranscriptCacheEntry = {
  mtimeMs: number
  transcript: SessionTranscriptStats | undefined
}

export class SessionTranscriptService {
  protected readonly _cacheByPath = new Map<string, TranscriptCacheEntry>()
  protected readonly _homeDir: string

  constructor(params: { homeDir: string } = { homeDir: homedir() }) {
    const { homeDir } = params
    this._homeDir = homeDir
  }

  async enrichSessions(params: { sessions: SessionInfo[] }): Promise<SessionInfo[]> {
    const { sessions } = params

    return Promise.all(
      sessions.map((session) => {
        return this._enrichSession({ session })
      }),
    )
  }

  protected async _enrichSession(params: { session: SessionInfo }): Promise<SessionInfo> {
    const { session } = params
    if (session.hostId !== undefined) {
      return session
    }

    const transcript = await this._resolveTranscript({
      cwd: session.cwd,
      sessionId: session.sessionId,
    })

    if (transcript === undefined) {
      return session
    }

    return { ...session, transcript }
  }

  protected _resolveDisplayableTranscript(params: {
    stats: SessionTranscriptStats
  }): SessionTranscriptStats | undefined {
    const { stats } = params
    if (new ClaudeTranscriptParserService().hasSignal(stats)) {
      return stats
    }

    return undefined
  }

  protected _resolveTranscriptFilePath(params: { cwd: string; sessionId: string }): string {
    const { cwd, sessionId } = params
    const projectDirName = cwd.replaceAll('/', '-')

    return join(this._homeDir, '.claude', 'projects', projectDirName, `${sessionId}.jsonl`)
  }

  protected async _resolveTranscript(params: {
    cwd: string
    sessionId: string
  }): Promise<SessionTranscriptStats | undefined> {
    const { cwd, sessionId } = params
    if (cwd === '' || sessionId === '') {
      return undefined
    }

    const filePath = this._resolveTranscriptFilePath({ cwd, sessionId })

    try {
      const fileStat = await stat(filePath)
      const cachedEntry = this._cacheByPath.get(filePath)

      if (cachedEntry?.mtimeMs === fileStat.mtimeMs) {
        return cachedEntry.transcript
      }

      const content = await readFile(filePath, 'utf8')
      const parsedStats = new ClaudeTranscriptParserService().parseStats({ content })
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
    transcript: SessionTranscriptStats | undefined
  }): void {
    const { filePath, mtimeMs, transcript } = params
    if (this._cacheByPath.size >= CACHE_ENTRY_LIMIT) {
      this._cacheByPath.clear()
    }

    this._cacheByPath.set(filePath, { mtimeMs, transcript })
  }
}
