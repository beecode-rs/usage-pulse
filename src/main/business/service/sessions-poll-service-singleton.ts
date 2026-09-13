import { singletonPattern } from '@beecode/msh-util'

import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { appEventBusSingleton } from '#src/main/business/service/app-event-bus-singleton'
import { SessionTranscriptService } from '#src/main/business/service/session-transcript-service'
import { sessionsServiceSingleton } from '#src/main/business/service/sessions-service-singleton'
import { sshSessionsServiceSingleton } from '#src/main/business/service/ssh-sessions-service-singleton'
import { errorUtil } from '#src/main/util/error-util'
import { type SessionSnapshot } from '#src/shared/business/model/session-model'
import { type AppSettings } from '#src/shared/business/model/settings-model'

export class _SessionsPollService {
  protected _isWindowVisible = false
  protected _refreshInFlight: Promise<SessionSnapshot> | undefined
  protected _settings: AppSettings | undefined
  protected _snapshot: SessionSnapshot | undefined
  protected _timer: NodeJS.Timeout | undefined
  protected readonly _sessionTranscriptService = new SessionTranscriptService()
  protected readonly _sessionsService = sessionsServiceSingleton()
  protected readonly _sshSessionsService = sshSessionsServiceSingleton()

  async start(params: { settings: AppSettings }): Promise<void> {
    const { settings } = params

    this._settings = settings

    if (!this._isWindowVisible) {
      return
    }

    await this._resumeAutoRefresh()
  }

  async restart(params: { settings: AppSettings }): Promise<void> {
    const { settings } = params

    this.stop()
    this._settings = settings
    await this.refreshNow()
  }

  stop(): void {
    if (this._timer === undefined) {
      return
    }

    clearTimeout(this._timer)
    this._timer = undefined
  }

  setWindowVisibility(params: { isVisible: boolean }): void {
    const { isVisible } = params

    if (isVisible === this._isWindowVisible) {
      return
    }

    this._isWindowVisible = isVisible

    if (!isVisible) {
      this.stop()

      return
    }

    void this._resumeAutoRefresh()
  }

  async refreshNow(): Promise<SessionSnapshot> {
    const inFlightRefresh = this._refreshInFlight

    if (inFlightRefresh !== undefined) {
      return await inFlightRefresh
    }

    const refresh = this._refreshSnapshot().finally(() => {
      this._refreshInFlight = undefined
    })

    this._refreshInFlight = refresh
    const snapshot = await refresh

    this._rescheduleAfterRefresh()

    return snapshot
  }

  getSnapshot(): SessionSnapshot | undefined {
    return this._snapshot
  }

  protected async _resumeAutoRefresh(): Promise<void> {
    const settings = this._settings

    if (settings === undefined || settings.isSessionsAutoRefreshPaused) {
      return
    }

    const resumeDelayMs = this._calcResumeDelayMs({ intervalMs: settings.sessionsRefreshIntervalMs })

    if (resumeDelayMs > 0) {
      this._scheduleNextRefresh({ delayMs: resumeDelayMs })

      return
    }

    await this.refreshNow()
  }

  protected _calcResumeDelayMs(params: { intervalMs: number }): number {
    const { intervalMs } = params
    const snapshot = this._snapshot

    if (snapshot === undefined) {
      return 0
    }

    const nextRefreshAt = snapshot.fetchedAt + intervalMs
    const resumeDelayMs = nextRefreshAt - Date.now()

    if (resumeDelayMs <= 0) {
      return 0
    }

    return resumeDelayMs
  }

  protected async _refreshSnapshot(): Promise<SessionSnapshot> {
    const settings = this._settings

    if (settings === undefined) {
      return { fetchedAt: Date.now(), sessions: [], unreachableHosts: [] }
    }

    try {
      const snapshot = await this._fetchSnapshot({ settings })

      this._snapshot = snapshot
      appEventBusSingleton().emit({ payload: snapshot, type: AppEventType.SESSIONS_SNAPSHOT })

      return snapshot
    } catch (error) {
      const snapshot = this._buildErrorSnapshot({ errorMessage: errorUtil.resolveMessage(error) })

      this._snapshot = snapshot
      appEventBusSingleton().emit({ payload: snapshot, type: AppEventType.SESSIONS_SNAPSHOT })

      return snapshot
    }
  }

  protected async _fetchSnapshot(params: { settings: AppSettings }): Promise<SessionSnapshot> {
    const { settings } = params
    const [localSnapshot, remoteResults] = await Promise.all([
      this._sessionsService.listSessions(),
      this._sshSessionsService.listRemoteSessions({ hosts: settings.sshHosts }),
    ])
    const mergedSnapshot = this._sshSessionsService.mergeSessionSnapshots({ localSnapshot, remoteResults })
    const sessions = await this._sessionTranscriptService
      .enrichSessions({ sessions: mergedSnapshot.sessions })
      .catch(() => {
        return mergedSnapshot.sessions
      })

    return { ...mergedSnapshot, sessions }
  }

  protected _buildErrorSnapshot(params: { errorMessage: string }): SessionSnapshot {
    const { errorMessage } = params

    return {
      errorMessage,
      fetchedAt: Date.now(),
      sessions: this._snapshot?.sessions ?? [],
      unreachableHosts: this._snapshot?.unreachableHosts ?? [],
    }
  }

  protected _rescheduleAfterRefresh(): void {
    const settings = this._settings

    if (settings === undefined || settings.isSessionsAutoRefreshPaused) {
      return
    }

    if (!this._isWindowVisible) {
      return
    }

    this._scheduleNextRefresh({ delayMs: settings.sessionsRefreshIntervalMs })
  }

  protected _scheduleNextRefresh(params: { delayMs: number }): void {
    const { delayMs } = params

    this.stop()

    this._timer = setTimeout(() => {
      void this._onRefreshTimer()
    }, delayMs)
  }

  protected async _onRefreshTimer(): Promise<void> {
    await this.refreshNow()
  }
}

export const sessionsPollServiceSingleton = singletonPattern(() => {
  return new _SessionsPollService()
})
