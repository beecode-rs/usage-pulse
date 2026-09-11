import { contextBridge, ipcRenderer } from 'electron'

import { IpcChannelMapper } from '#src/shared/business/enum/ipc-channel-mapper-enum'
import type { OS } from '#src/shared/business/enum/os-enum'
import {
  type ScheduleTriggerRegistrationHealth,
  type ScheduleTriggerRunLogEntry,
  type SchedulingInfo,
} from '#src/shared/business/model/schedule-trigger-model'
import {
  type SessionFocusSupport,
  type SessionSnapshot,
  type SessionsUpdateListener,
} from '#src/shared/business/model/session-model'
import { type AppSettings } from '#src/shared/business/model/settings-model'
import { type UpdateStatus, type UpdateStatusListener } from '#src/shared/business/model/update-model'
import {
  type SettingsUpdateListener,
  type UsageApiClient,
  type UsageSnapshot,
  type UsageUpdateListener,
} from '#src/shared/business/model/usage-model'

const usageApi: UsageApiClient = {
  clearTriggerRunLogs: (params: { triggerId: string }): Promise<void> => {
    return ipcRenderer.invoke(IpcChannelMapper.TRIGGER_CLEAR_RUN_LOGS, params)
  },
  focusSession: (params: { cwd: string; pid: number }): Promise<void> => {
    return ipcRenderer.invoke(IpcChannelMapper.SESSIONS_FOCUS, params)
  },
  getPlatform: (): Promise<OS> => {
    return ipcRenderer.invoke(IpcChannelMapper.OS_GET_PLATFORM)
  },
  getSchedulingInfo: (): Promise<SchedulingInfo> => {
    return ipcRenderer.invoke(IpcChannelMapper.SCHEDULING_GET_INFO)
  },
  getSessionFocusSupport: (): Promise<SessionFocusSupport> => {
    return ipcRenderer.invoke(IpcChannelMapper.SESSIONS_GET_FOCUS_SUPPORT)
  },
  getSessionsSnapshot: (): Promise<SessionSnapshot | undefined> => {
    return ipcRenderer.invoke(IpcChannelMapper.SESSIONS_GET_SNAPSHOT)
  },
  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke(IpcChannelMapper.SETTINGS_GET)
  },
  getSnapshot: (): Promise<UsageSnapshot> => {
    return ipcRenderer.invoke(IpcChannelMapper.USAGE_GET_SNAPSHOT)
  },
  getTriggerRunLogs: (params: { triggerId: string }): Promise<ScheduleTriggerRunLogEntry[]> => {
    return ipcRenderer.invoke(IpcChannelMapper.TRIGGER_GET_RUN_LOGS, params)
  },
  getUpdateStatus: (): Promise<UpdateStatus> => {
    return ipcRenderer.invoke(IpcChannelMapper.UPDATE_GET_STATUS)
  },
  inspectTriggerRegistrations: (): Promise<ScheduleTriggerRegistrationHealth[]> => {
    return ipcRenderer.invoke(IpcChannelMapper.TRIGGER_OS_INSPECT)
  },
  installSessionFocusTool: (): Promise<SessionFocusSupport> => {
    return ipcRenderer.invoke(IpcChannelMapper.SESSIONS_INSTALL_FOCUS_TOOL)
  },
  listSessions: (): Promise<SessionSnapshot> => {
    return ipcRenderer.invoke(IpcChannelMapper.SESSIONS_LIST)
  },
  onSessionsUpdate: (listener: SessionsUpdateListener): (() => void) => {
    const sessionsUpdateListener = (_event: Electron.IpcRendererEvent, snapshot: SessionSnapshot): void => {
      listener(snapshot)
    }

    ipcRenderer.on(IpcChannelMapper.SESSIONS_UPDATE, sessionsUpdateListener)

    return () => {
      ipcRenderer.removeListener(IpcChannelMapper.SESSIONS_UPDATE, sessionsUpdateListener)
    }
  },
  onSettingsUpdate: (listener: SettingsUpdateListener): (() => void) => {
    const settingsUpdateListener = (_event: Electron.IpcRendererEvent, settings: AppSettings): void => {
      listener(settings)
    }

    ipcRenderer.on(IpcChannelMapper.SETTINGS_UPDATE, settingsUpdateListener)

    return () => {
      ipcRenderer.removeListener(IpcChannelMapper.SETTINGS_UPDATE, settingsUpdateListener)
    }
  },
  onUpdateStatus: (listener: UpdateStatusListener): (() => void) => {
    const updateStatusListener = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void => {
      listener(status)
    }

    ipcRenderer.on(IpcChannelMapper.UPDATE_STATUS, updateStatusListener)

    return () => {
      ipcRenderer.removeListener(IpcChannelMapper.UPDATE_STATUS, updateStatusListener)
    }
  },
  onUsageUpdate: (listener: UsageUpdateListener): (() => void) => {
    const usageUpdateListener = (_event: Electron.IpcRendererEvent, snapshot: UsageSnapshot): void => {
      listener(snapshot)
    }

    ipcRenderer.on(IpcChannelMapper.USAGE_UPDATE, usageUpdateListener)

    return () => {
      ipcRenderer.removeListener(IpcChannelMapper.USAGE_UPDATE, usageUpdateListener)
    }
  },
  openRelease: (): void => {
    ipcRenderer.send(IpcChannelMapper.UPDATE_OPEN_RELEASE)
  },
  refreshNow: (): Promise<void> => {
    return ipcRenderer.invoke(IpcChannelMapper.USAGE_REFRESH)
  },
  refreshTracker: (params: { trackerId: string }): Promise<void> => {
    return ipcRenderer.invoke(IpcChannelMapper.USAGE_REFRESH_TRACKER, params.trackerId)
  },
  saveSettings: (settings: AppSettings): Promise<AppSettings> => {
    return ipcRenderer.invoke(IpcChannelMapper.SETTINGS_SAVE, settings)
  },
  setSchedulingEnabled: (params: { isEnabled: boolean }): Promise<AppSettings> => {
    return ipcRenderer.invoke(IpcChannelMapper.SCHEDULING_SET_ENABLED, params)
  },
  setTrackerPaused: (params: { isAutoRefreshPaused: boolean; trackerId: string }): Promise<AppSettings> => {
    return ipcRenderer.invoke(IpcChannelMapper.USAGE_SET_TRACKER_PAUSED, params)
  },
  setTriggerEnabled: (params: { isEnabled: boolean; triggerId: string }): Promise<AppSettings> => {
    return ipcRenderer.invoke(IpcChannelMapper.TRIGGER_SET_ENABLED, params)
  },
  testSshHost: (params: { url: string }): Promise<void> => {
    return ipcRenderer.invoke(IpcChannelMapper.SESSIONS_TEST_SSH_HOST, params)
  },
}

contextBridge.exposeInMainWorld('usageApi', usageApi)
