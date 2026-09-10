import type { OS } from '#src/shared/os-model'
import type { ISessionFocusSupport, ISessionSnapshot, SessionsUpdateListener } from '#src/shared/session-model'
import type { IAppSettings } from '#src/shared/settings-model'
import type { ISchedulingInfo, ITriggerRegistrationHealth, ITriggerRunLogEntry } from '#src/shared/trigger-model'
import type { IUpdateStatus, UpdateStatusListener } from '#src/shared/update-model'

export type ProviderId = 'claude' | 'dummy' | 'zai'

export const FIVE_HOUR_WINDOW_MS = 5 * 60 * 60 * 1000

export const SEVEN_DAY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export enum UsageStatus {
  ERROR = 'ERROR',
  OK = 'OK',
  PENDING = 'PENDING',
  UNCONFIGURED = 'UNCONFIGURED',
}

export interface IUsageWindow {
  label: string
  resetAt?: number
  totalAmount?: number
  usedAmount?: number
  usedPercent: number
  windowMs?: number
}

export interface IProviderSnapshot {
  errorMessage?: string
  fetchedAt?: number
  nextRefreshAt?: number
  providerId: ProviderId
  status: UsageStatus
  trackerId: string
  trackerName: string
  usage?: IUsageWindow[]
}

export interface IUsageSnapshot {
  providers: IProviderSnapshot[]
}

export type UsageUpdateListener = (snapshot: IUsageSnapshot) => void

export type SettingsUpdateListener = (settings: IAppSettings) => void

export interface IUsageApiClient {
  clearTriggerRunLogs: (params: { triggerId: string }) => Promise<void>
  focusSession: (params: { cwd: string; pid: number }) => Promise<void>
  getPlatform: () => Promise<OS>
  getSessionFocusSupport: () => Promise<ISessionFocusSupport>
  getSessionsSnapshot: () => Promise<ISessionSnapshot | undefined>
  getSettings: () => Promise<IAppSettings>
  getSchedulingInfo: () => Promise<ISchedulingInfo>
  getSnapshot: () => Promise<IUsageSnapshot>
  getTriggerRunLogs: (params: { triggerId: string }) => Promise<ITriggerRunLogEntry[]>
  getUpdateStatus: () => Promise<IUpdateStatus>
  inspectTriggerRegistrations: () => Promise<ITriggerRegistrationHealth[]>
  installSessionFocusTool: () => Promise<ISessionFocusSupport>
  listSessions: () => Promise<ISessionSnapshot>
  onSessionsUpdate: (listener: SessionsUpdateListener) => () => void
  onSettingsUpdate: (listener: SettingsUpdateListener) => () => void
  onUpdateStatus: (listener: UpdateStatusListener) => () => void
  onUsageUpdate: (listener: UsageUpdateListener) => () => void
  openRelease: () => void
  refreshNow: () => Promise<void>
  refreshTracker: (params: { trackerId: string }) => Promise<void>
  saveSettings: (settings: IAppSettings) => Promise<IAppSettings>
  setSchedulingEnabled: (params: { isEnabled: boolean }) => Promise<IAppSettings>
  setTriggerEnabled: (params: { isEnabled: boolean; triggerId: string }) => Promise<IAppSettings>
  setTrackerPaused: (params: { isAutoRefreshPaused: boolean; trackerId: string }) => Promise<IAppSettings>
  testSshHost: (params: { url: string }) => Promise<void>
}
