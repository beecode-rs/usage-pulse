import type { OS } from '#src/shared/business/enum/os-enum'
import type { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import type { UsageStatus } from '#src/shared/business/enum/usage-status-enum'
import type {
  ScheduleTriggerRegistrationHealth,
  ScheduleTriggerRunLogEntry,
  SchedulingInfo,
} from '#src/shared/business/model/schedule-trigger-model'
import type {
  SessionFocusSupport,
  SessionSnapshot,
  SessionsUpdateListener,
} from '#src/shared/business/model/session-model'
import type { AppSettings } from '#src/shared/business/model/settings-model'
import type { UpdateStatus, UpdateStatusListener } from '#src/shared/business/model/update-model'

export type UsageWindow = {
  label: string
  resetAt?: number
  totalAmount?: number
  usedAmount?: number
  usedPercent: number
  windowMs?: number
}

export type ProviderSnapshot = {
  errorMessage?: string
  fetchedAt?: number
  nextRefreshAt?: number
  providerId: ProviderIdMapper
  status: UsageStatus
  trackerId: string
  trackerName: string
  usage?: UsageWindow[]
}

export type UsageSnapshot = {
  providers: ProviderSnapshot[]
}

export type UsageUpdateListener = (snapshot: UsageSnapshot) => void

export type SettingsUpdateListener = (settings: AppSettings) => void

export type UsageApiClient = {
  clearTriggerRunLogs: (params: { triggerId: string }) => Promise<void>
  focusSession: (params: { cwd: string; pid: number }) => Promise<void>
  getPlatform: () => Promise<OS>
  getSessionFocusSupport: () => Promise<SessionFocusSupport>
  getSessionsSnapshot: () => Promise<SessionSnapshot | undefined>
  getSettings: () => Promise<AppSettings>
  getSchedulingInfo: () => Promise<SchedulingInfo>
  getSnapshot: () => Promise<UsageSnapshot>
  getTriggerRunLogs: (params: { triggerId: string }) => Promise<ScheduleTriggerRunLogEntry[]>
  getUpdateStatus: () => Promise<UpdateStatus>
  inspectTriggerRegistrations: () => Promise<ScheduleTriggerRegistrationHealth[]>
  installSessionFocusTool: () => Promise<SessionFocusSupport>
  listSessions: () => Promise<SessionSnapshot>
  onSessionsUpdate: (listener: SessionsUpdateListener) => () => void
  onSettingsUpdate: (listener: SettingsUpdateListener) => () => void
  onUpdateStatus: (listener: UpdateStatusListener) => () => void
  onUsageUpdate: (listener: UsageUpdateListener) => () => void
  openRelease: () => void
  refreshNow: () => Promise<void>
  refreshTracker: (params: { trackerId: string }) => Promise<void>
  saveSettings: (settings: AppSettings) => Promise<AppSettings>
  setSchedulingEnabled: (params: { isEnabled: boolean }) => Promise<AppSettings>
  setTriggerEnabled: (params: { isEnabled: boolean; triggerId: string }) => Promise<AppSettings>
  setTrackerPaused: (params: { isAutoRefreshPaused: boolean; trackerId: string }) => Promise<AppSettings>
  testSshHost: (params: { url: string }) => Promise<void>
}
