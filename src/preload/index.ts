import { contextBridge, ipcRenderer } from 'electron'

import { IpcChannelMapper } from '#src/shared/ipc-channel'
import type { OS } from '#src/shared/os-model'
import {
  type ISessionFocusSupport,
  type ISessionSnapshot,
  type SessionsUpdateListener,
} from '#src/shared/session-model'
import { type IAppSettings } from '#src/shared/settings-model'
import {
  type ISchedulingInfo,
  type ITriggerRegistrationHealth,
  type ITriggerRunLogEntry,
} from '#src/shared/trigger-model'
import { type IUpdateStatus, type UpdateStatusListener } from '#src/shared/update-model'
import {
  type IUsageApiClient,
  type IUsageSnapshot,
  type SettingsUpdateListener,
  type UsageUpdateListener,
} from '#src/shared/usage-model'

const usageApi: IUsageApiClient = {
  clearTriggerRunLogs: (params: { triggerId: string }): Promise<void> => {
    return ipcRenderer.invoke(IpcChannelMapper.TRIGGER_CLEAR_RUN_LOGS, params)
  },
  focusSession: (params: { cwd: string; pid: number }): Promise<void> => {
    return ipcRenderer.invoke(IpcChannelMapper.SESSIONS_FOCUS, params)
  },
  getPlatform: (): Promise<OS> => {
    return ipcRenderer.invoke(IpcChannelMapper.OS_GET_PLATFORM)
  },
  getSchedulingInfo: (): Promise<ISchedulingInfo> => {
    return ipcRenderer.invoke(IpcChannelMapper.SCHEDULING_GET_INFO)
  },
  getSessionFocusSupport: (): Promise<ISessionFocusSupport> => {
    return ipcRenderer.invoke(IpcChannelMapper.SESSIONS_GET_FOCUS_SUPPORT)
  },
  getSessionsSnapshot: (): Promise<ISessionSnapshot | undefined> => {
    return ipcRenderer.invoke(IpcChannelMapper.SESSIONS_GET_SNAPSHOT)
  },
  getSettings: (): Promise<IAppSettings> => {
    return ipcRenderer.invoke(IpcChannelMapper.SETTINGS_GET)
  },
  getSnapshot: (): Promise<IUsageSnapshot> => {
    return ipcRenderer.invoke(IpcChannelMapper.USAGE_GET_SNAPSHOT)
  },
  getTriggerRunLogs: (params: { triggerId: string }): Promise<ITriggerRunLogEntry[]> => {
    return ipcRenderer.invoke(IpcChannelMapper.TRIGGER_GET_RUN_LOGS, params)
  },
  getUpdateStatus: (): Promise<IUpdateStatus> => {
    return ipcRenderer.invoke(IpcChannelMapper.UPDATE_GET_STATUS)
  },
  inspectTriggerRegistrations: (): Promise<ITriggerRegistrationHealth[]> => {
    return ipcRenderer.invoke(IpcChannelMapper.TRIGGER_OS_INSPECT)
  },
  installSessionFocusTool: (): Promise<ISessionFocusSupport> => {
    return ipcRenderer.invoke(IpcChannelMapper.SESSIONS_INSTALL_FOCUS_TOOL)
  },
  listSessions: (): Promise<ISessionSnapshot> => {
    return ipcRenderer.invoke(IpcChannelMapper.SESSIONS_LIST)
  },
  onSessionsUpdate: (listener: SessionsUpdateListener): (() => void) => {
    const sessionsUpdateListener = (_event: Electron.IpcRendererEvent, snapshot: ISessionSnapshot): void => {
      listener(snapshot)
    }

    ipcRenderer.on(IpcChannelMapper.SESSIONS_UPDATE, sessionsUpdateListener)

    return () => {
      ipcRenderer.removeListener(IpcChannelMapper.SESSIONS_UPDATE, sessionsUpdateListener)
    }
  },
  onSettingsUpdate: (listener: SettingsUpdateListener): (() => void) => {
    const settingsUpdateListener = (_event: Electron.IpcRendererEvent, settings: IAppSettings): void => {
      listener(settings)
    }

    ipcRenderer.on(IpcChannelMapper.SETTINGS_UPDATE, settingsUpdateListener)

    return () => {
      ipcRenderer.removeListener(IpcChannelMapper.SETTINGS_UPDATE, settingsUpdateListener)
    }
  },
  onUpdateStatus: (listener: UpdateStatusListener): (() => void) => {
    const updateStatusListener = (_event: Electron.IpcRendererEvent, status: IUpdateStatus): void => {
      listener(status)
    }

    ipcRenderer.on(IpcChannelMapper.UPDATE_STATUS, updateStatusListener)

    return () => {
      ipcRenderer.removeListener(IpcChannelMapper.UPDATE_STATUS, updateStatusListener)
    }
  },
  onUsageUpdate: (listener: UsageUpdateListener): (() => void) => {
    const usageUpdateListener = (_event: Electron.IpcRendererEvent, snapshot: IUsageSnapshot): void => {
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
  saveSettings: (settings: IAppSettings): Promise<IAppSettings> => {
    return ipcRenderer.invoke(IpcChannelMapper.SETTINGS_SAVE, settings)
  },
  setSchedulingEnabled: (params: { isEnabled: boolean }): Promise<IAppSettings> => {
    return ipcRenderer.invoke(IpcChannelMapper.SCHEDULING_SET_ENABLED, params)
  },
  setTrackerPaused: (params: { isAutoRefreshPaused: boolean; trackerId: string }): Promise<IAppSettings> => {
    return ipcRenderer.invoke(IpcChannelMapper.USAGE_SET_TRACKER_PAUSED, params)
  },
  setTriggerEnabled: (params: { isEnabled: boolean; triggerId: string }): Promise<IAppSettings> => {
    return ipcRenderer.invoke(IpcChannelMapper.TRIGGER_SET_ENABLED, params)
  },
  testSshHost: (params: { url: string }): Promise<void> => {
    return ipcRenderer.invoke(IpcChannelMapper.SESSIONS_TEST_SSH_HOST, params)
  },
}

contextBridge.exposeInMainWorld('usageApi', usageApi)
