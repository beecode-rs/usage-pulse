import { singletonPattern } from '@beecode/msh-util'
import { ipcMain } from 'electron'

import { ipcOs } from '#src/main/controller/ipc/os'
import { ipcScheduling } from '#src/main/controller/ipc/scheduling'
import { ipcSessions } from '#src/main/controller/ipc/sessions'
import { ipcSettings } from '#src/main/controller/ipc/settings'
import { ipcTrigger } from '#src/main/controller/ipc/trigger'
import { ipcUpdate } from '#src/main/controller/ipc/update'
import { ipcUsage } from '#src/main/controller/ipc/usage'
import { IpcChannelMapper } from '#src/shared/business/enum/ipc-channel-mapper-enum'

export class IpcRouter {
  register(): void {
    // os
    ipcMain.handle(IpcChannelMapper.OS_GET_PLATFORM, ipcOs.getPlatform)

    // scheduling
    ipcMain.handle(IpcChannelMapper.SCHEDULING_GET_INFO, ipcScheduling.getInfo)
    ipcMain.handle(IpcChannelMapper.SCHEDULING_SET_ENABLED, ipcScheduling.setEnabled)

    // sessions
    ipcMain.handle(IpcChannelMapper.SESSIONS_FOCUS, ipcSessions.focus)
    ipcMain.handle(IpcChannelMapper.SESSIONS_GET_FOCUS_SUPPORT, ipcSessions.isFocusSupported)
    ipcMain.handle(IpcChannelMapper.SESSIONS_GET_SNAPSHOT, ipcSessions.getSnapshot)
    ipcMain.handle(IpcChannelMapper.SESSIONS_INSTALL_FOCUS_TOOL, ipcSessions.installFocusTool)
    ipcMain.handle(IpcChannelMapper.SESSIONS_LIST, ipcSessions.list)
    ipcMain.handle(IpcChannelMapper.SESSIONS_TEST_SSH_HOST, ipcSessions.testSshHost)

    // settings
    ipcMain.handle(IpcChannelMapper.SETTINGS_GET, ipcSettings.get)
    ipcMain.handle(IpcChannelMapper.SETTINGS_SAVE, ipcSettings.save)

    // trigger
    ipcMain.handle(IpcChannelMapper.TRIGGER_CLEAR_RUN_LOGS, ipcTrigger.clearRunLogs)
    ipcMain.handle(IpcChannelMapper.TRIGGER_GET_RUN_LOGS, ipcTrigger.getRunLogs)
    ipcMain.handle(IpcChannelMapper.TRIGGER_OS_INSPECT, ipcTrigger.inspectRegistrations)
    ipcMain.handle(IpcChannelMapper.TRIGGER_SET_ENABLED, ipcTrigger.setEnabled)

    // update
    ipcMain.handle(IpcChannelMapper.UPDATE_GET_STATUS, ipcUpdate.getStatus)
    ipcMain.on(IpcChannelMapper.UPDATE_OPEN_RELEASE, ipcUpdate.openRelease)

    // usage
    ipcMain.handle(IpcChannelMapper.USAGE_GET_SNAPSHOT, ipcUsage.getSnapshot)
    ipcMain.handle(IpcChannelMapper.USAGE_REFRESH, ipcUsage.refresh)
    ipcMain.handle(IpcChannelMapper.USAGE_REFRESH_TRACKER, ipcUsage.refreshTracker)
    ipcMain.handle(IpcChannelMapper.USAGE_SET_TRACKER_PAUSED, ipcUsage.setTrackerPaused)
  }
}

export const ipcRouterSingleton = singletonPattern(() => {
  return new IpcRouter()
})
