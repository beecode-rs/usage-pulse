import { type BrowserWindow, ipcMain, shell } from 'electron'

import { type TriggerRunLogRepo } from '#src/main/business/repo/trigger-run-log-repo'
import { type SchedulingService } from '#src/main/business/service/scheduling-service'
import { type SessionsPollService } from '#src/main/business/service/sessions-poll-service'
import { type SessionsService } from '#src/main/business/service/sessions-service'
import { type SshSessionsService } from '#src/main/business/service/ssh-sessions-service'
import { type UpdateService } from '#src/main/business/service/update-service'
import { type UsagePollService } from '#src/main/business/service/usage-poll-service'
import { type SettingsUseCase } from '#src/main/business/use-case/settings-use-case'
import { objectUtil } from '#src/main/util/object-util'
import { type OS, osUtil } from '#src/main/util/os-util'
import { IpcChannelMapper } from '#src/shared/ipc-channel'
import { type ISessionFocusSupport, type ISessionSnapshot } from '#src/shared/session-model'
import { type IAppSettings } from '#src/shared/settings-model'
import {
  type ISchedulingInfo,
  type ITriggerRegistrationHealth,
  type ITriggerRunLogEntry,
} from '#src/shared/trigger-model'
import { type IUpdateStatus } from '#src/shared/update-model'
import { type IUsageSnapshot } from '#src/shared/usage-model'

export const ipcController = {
  register: (params: {
    getWindow: () => BrowserWindow
    pollService: UsagePollService
    schedulingService: SchedulingService
    sessionsPollService: SessionsPollService
    sessionsService: SessionsService
    settingsUseCase: SettingsUseCase
    sshSessionsService: SshSessionsService
    triggerRunLogRepo: TriggerRunLogRepo
    updateService: UpdateService
  }): void => {
    ipcMain.handle(IpcChannelMapper.OS_GET_PLATFORM, (): OS => {
      return osUtil.resolvePlatform()
    })

    ipcMain.handle(IpcChannelMapper.SCHEDULING_GET_INFO, (): ISchedulingInfo => {
      return params.schedulingService.getSchedulingInfo()
    })

    ipcMain.handle(
      IpcChannelMapper.SCHEDULING_SET_ENABLED,
      async (_event, rawParams: unknown): Promise<IAppSettings> => {
        const rawRecord = objectUtil.asRecord(rawParams)
        const isEnabled = rawRecord?.['isEnabled']

        if (typeof isEnabled !== 'boolean') {
          return await params.settingsUseCase.loadSettings()
        }

        return await params.settingsUseCase.setSchedulingEnabled({ isEnabled })
      },
    )

    ipcMain.handle(IpcChannelMapper.SESSIONS_FOCUS, async (_event, rawParams: unknown): Promise<void> => {
      const rawRecord = objectUtil.asRecord(rawParams)
      const pid = rawRecord?.['pid']
      const cwd = rawRecord?.['cwd']

      if (typeof pid !== 'number' || typeof cwd !== 'string') {
        return
      }

      await params.sessionsService.focusSession({ cwd, pid })
    })

    ipcMain.handle(IpcChannelMapper.SESSIONS_GET_FOCUS_SUPPORT, (): Promise<ISessionFocusSupport> => {
      return params.sessionsService.getFocusSupport()
    })

    ipcMain.handle(IpcChannelMapper.SESSIONS_GET_SNAPSHOT, (): ISessionSnapshot | undefined => {
      return params.sessionsPollService.getSnapshot()
    })

    ipcMain.handle(IpcChannelMapper.SESSIONS_INSTALL_FOCUS_TOOL, (): Promise<ISessionFocusSupport> => {
      return params.sessionsService.installFocusTool()
    })

    ipcMain.handle(IpcChannelMapper.SESSIONS_LIST, async (): Promise<ISessionSnapshot> => {
      return await params.sessionsPollService.refreshNow()
    })

    ipcMain.handle(IpcChannelMapper.SESSIONS_TEST_SSH_HOST, async (_event, rawParams: unknown): Promise<void> => {
      const rawRecord = objectUtil.asRecord(rawParams)
      const url = rawRecord?.['url']

      if (typeof url !== 'string' || url.trim() === '') {
        throw new Error('an ssh host url is required')
      }

      await params.sshSessionsService.testHost({ url })
    })

    ipcMain.handle(IpcChannelMapper.SETTINGS_GET, async (): Promise<IAppSettings> => {
      return await params.settingsUseCase.loadSettings()
    })

    ipcMain.handle(IpcChannelMapper.SETTINGS_SAVE, async (_event, rawSettings: unknown): Promise<IAppSettings> => {
      return await params.settingsUseCase.saveSettings({ rawSettings })
    })

    ipcMain.handle(IpcChannelMapper.TRIGGER_CLEAR_RUN_LOGS, async (_event, rawParams: unknown): Promise<void> => {
      const rawRecord = objectUtil.asRecord(rawParams)
      const triggerId = rawRecord?.['triggerId']

      if (typeof triggerId !== 'string') {
        return
      }

      await params.triggerRunLogRepo.removeByTriggerId({ triggerId })
    })

    ipcMain.handle(
      IpcChannelMapper.TRIGGER_GET_RUN_LOGS,
      async (_event, rawParams: unknown): Promise<ITriggerRunLogEntry[]> => {
        const rawRecord = objectUtil.asRecord(rawParams)
        const triggerId = rawRecord?.['triggerId']

        if (typeof triggerId !== 'string') {
          return []
        }

        return await params.triggerRunLogRepo.listByTriggerId({ triggerId })
      },
    )

    ipcMain.handle(IpcChannelMapper.TRIGGER_OS_INSPECT, async (): Promise<ITriggerRegistrationHealth[]> => {
      const settings = await params.settingsUseCase.loadSettings()

      return await params.schedulingService.inspectRegistrations({ settings })
    })

    ipcMain.handle(IpcChannelMapper.TRIGGER_SET_ENABLED, async (_event, rawParams: unknown): Promise<IAppSettings> => {
      const rawRecord = objectUtil.asRecord(rawParams)
      const triggerId = rawRecord?.['triggerId']
      const isEnabled = rawRecord?.['isEnabled']

      if (typeof triggerId !== 'string' || typeof isEnabled !== 'boolean') {
        return await params.settingsUseCase.loadSettings()
      }

      return await params.settingsUseCase.setTriggerEnabled({ isEnabled, triggerId })
    })

    ipcMain.handle(IpcChannelMapper.UPDATE_GET_STATUS, (): IUpdateStatus => {
      return params.updateService.getStatus()
    })

    ipcMain.on(IpcChannelMapper.UPDATE_OPEN_RELEASE, (): void => {
      const releaseUrl = params.updateService.getStatus().releaseUrl

      if (!releaseUrl?.startsWith('https://github.com/')) {
        return
      }

      void shell.openExternal(releaseUrl)
    })

    ipcMain.handle(IpcChannelMapper.USAGE_GET_SNAPSHOT, (): IUsageSnapshot => {
      return params.pollService.getSnapshot()
    })

    ipcMain.handle(IpcChannelMapper.USAGE_REFRESH, async (): Promise<void> => {
      await params.pollService.refreshNow()
    })

    ipcMain.handle(IpcChannelMapper.USAGE_REFRESH_TRACKER, async (_event, trackerId: unknown): Promise<void> => {
      if (typeof trackerId !== 'string') {
        return
      }

      await params.pollService.refreshTracker({ trackerId })
    })

    ipcMain.handle(
      IpcChannelMapper.USAGE_SET_TRACKER_PAUSED,
      async (_event, rawParams: unknown): Promise<IAppSettings> => {
        const rawRecord = objectUtil.asRecord(rawParams)
        const trackerId = rawRecord?.['trackerId']
        const isAutoRefreshPaused = rawRecord?.['isAutoRefreshPaused']

        if (typeof trackerId !== 'string' || typeof isAutoRefreshPaused !== 'boolean') {
          return await params.settingsUseCase.loadSettings()
        }

        return await params.settingsUseCase.setTrackerPaused({ isAutoRefreshPaused, trackerId })
      },
    )

    params.pollService.onUpdate({
      listener: (snapshot) => {
        const browserWindow = params.getWindow()

        if (browserWindow.isDestroyed()) {
          return
        }

        browserWindow.webContents.send(IpcChannelMapper.USAGE_UPDATE, snapshot)
      },
    })

    params.sessionsPollService.onUpdate({
      listener: (snapshot) => {
        const browserWindow = params.getWindow()

        if (browserWindow.isDestroyed()) {
          return
        }

        browserWindow.webContents.send(IpcChannelMapper.SESSIONS_UPDATE, snapshot)
      },
    })

    params.settingsUseCase.onSave({
      listener: ({ settings }) => {
        const browserWindow = params.getWindow()

        if (browserWindow.isDestroyed()) {
          return
        }

        browserWindow.webContents.send(IpcChannelMapper.SETTINGS_UPDATE, settings)
      },
    })

    params.updateService.onUpdate({
      listener: (status) => {
        const browserWindow = params.getWindow()

        if (browserWindow.isDestroyed()) {
          return
        }

        browserWindow.webContents.send(IpcChannelMapper.UPDATE_STATUS, status)
      },
    })
  },
}
