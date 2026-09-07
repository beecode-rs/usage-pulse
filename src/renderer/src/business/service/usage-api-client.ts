import type { OS } from '#src/shared/business/enum/os-enum'
import type {
  ScheduleTriggerRegistrationHealth,
  ScheduleTriggerRunLogEntry,
  SchedulingInfo,
} from '#src/shared/business/model/schedule-trigger-model'
import type { SessionSnapshot, SessionsUpdateListener } from '#src/shared/business/model/session-model'
import type { SettingsModel } from '#src/shared/business/model/settings-model'
import type { UpdateStatus, UpdateStatusListener } from '#src/shared/business/model/update-model'
import type { SettingsUpdateListener, UsageSnapshot, UsageUpdateListener } from '#src/shared/business/model/usage-model'

export type UsageApiClient = {
  clearTriggerRunLogs: (params: { triggerId: string }) => Promise<void>
  focusSession: (params: { cwd: string; pid: number }) => Promise<void>
  getPlatform: () => Promise<OS>
  getSessionsSnapshot: () => Promise<SessionSnapshot | undefined>
  getSettings: () => Promise<SettingsModel>
  getSchedulingInfo: () => Promise<SchedulingInfo>
  getSnapshot: () => Promise<UsageSnapshot>
  getTriggerRunLogs: (params: { triggerId: string }) => Promise<ScheduleTriggerRunLogEntry[]>
  getUpdateStatus: () => Promise<UpdateStatus>
  inspectTriggerRegistrations: () => Promise<ScheduleTriggerRegistrationHealth[]>
  installSessionFocusTool: () => Promise<void>
  isSessionFocusSupported: () => Promise<boolean>
  listSessions: () => Promise<SessionSnapshot>
  onSessionsUpdate: (listener: SessionsUpdateListener) => () => void
  onSettingsUpdate: (listener: SettingsUpdateListener) => () => void
  onUpdateStatus: (listener: UpdateStatusListener) => () => void
  onUsageUpdate: (listener: UsageUpdateListener) => () => void
  openRelease: () => void
  refreshNow: () => Promise<void>
  refreshTracker: (params: { trackerId: string }) => Promise<void>
  saveSettings: (settings: SettingsModel) => Promise<SettingsModel>
  setSchedulingEnabled: (params: { isEnabled: boolean }) => Promise<SettingsModel>
  setTriggerEnabled: (params: { isEnabled: boolean; triggerId: string }) => Promise<SettingsModel>
  setTrackerPaused: (params: { isAutoRefreshPaused: boolean; trackerId: string }) => Promise<SettingsModel>
  testSshHost: (params: { url: string }) => Promise<void>
}
