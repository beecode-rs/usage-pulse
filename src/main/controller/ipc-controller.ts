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
import { osUtil } from '#src/main/util/os-util'
import { IpcChannelMapper } from '#src/shared/business/enum/ipc-channel-mapper-enum'
import { type OS } from '#src/shared/business/enum/os-enum'
import {
  type ScheduleTriggerRegistrationHealth,
  type ScheduleTriggerRunLogEntry,
  type SchedulingInfo,
} from '#src/shared/business/model/schedule-trigger-model'
import { type SessionFocusSupport, type SessionSnapshot } from '#src/shared/business/model/session-model'
import { type AppSettings } from '#src/shared/business/model/settings-model'
import { type UpdateStatus } from '#src/shared/business/model/update-model'
import { type UsageSnapshot } from '#src/shared/business/model/usage-model'

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

    ipcMain.handle(IpcChannelMapper.SCHEDULING_GET_INFO, (): SchedulingInfo => {
      return params.schedulingService.getSchedulingInfo()
    })

    ipcMain.handle(
      IpcChannelMapper.SCHEDULING_SET_ENABLED,
      async (_event, rawParams: unknown): Promise<AppSettings> => {
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

    ipcMain.handle(IpcChannelMapper.SESSIONS_GET_FOCUS_SUPPORT, (): Promise<SessionFocusSupport> => {
      return params.sessionsService.getFocusSupport()
    })

    ipcMain.handle(IpcChannelMapper.SESSIONS_GET_SNAPSHOT, (): SessionSnapshot | undefined => {
      return params.sessionsPollService.getSnapshot()
    })

    ipcMain.handle(IpcChannelMapper.SESSIONS_INSTALL_FOCUS_TOOL, (): Promise<SessionFocusSupport> => {
      return params.sessionsService.installFocusTool()
    })

    ipcMain.handle(IpcChannelMapper.SESSIONS_LIST, async (): Promise<SessionSnapshot> => {
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

    ipcMain.handle(IpcChannelMapper.SETTINGS_GET, async (): Promise<AppSettings> => {
      return await params.settingsUseCase.loadSettings()
    })

    ipcMain.handle(IpcChannelMapper.SETTINGS_SAVE, async (_event, rawSettings: unknown): Promise<AppSettings> => {
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
      async (_event, rawParams: unknown): Promise<ScheduleTriggerRunLogEntry[]> => {
        const rawRecord = objectUtil.asRecord(rawParams)
        const triggerId = rawRecord?.['triggerId']

        if (typeof triggerId !== 'string') {
          return []
        }

        return await params.triggerRunLogRepo.listByTriggerId({ triggerId })
      },
    )

    ipcMain.handle(IpcChannelMapper.TRIGGER_OS_INSPECT, async (): Promise<ScheduleTriggerRegistrationHealth[]> => {
      const settings = await params.settingsUseCase.loadSettings()

      return await params.schedulingService.inspectRegistrations({ settings })
    })

    ipcMain.handle(IpcChannelMapper.TRIGGER_SET_ENABLED, async (_event, rawParams: unknown): Promise<AppSettings> => {
      const rawRecord = objectUtil.asRecord(rawParams)
      const triggerId = rawRecord?.['triggerId']
      const isEnabled = rawRecord?.['isEnabled']

      if (typeof triggerId !== 'string' || typeof isEnabled !== 'boolean') {
        return await params.settingsUseCase.loadSettings()
      }

      return await params.settingsUseCase.setTriggerEnabled({ isEnabled, triggerId })
    })

    ipcMain.handle(IpcChannelMapper.UPDATE_GET_STATUS, (): UpdateStatus => {
      return params.updateService.getStatus()
    })

    ipcMain.on(IpcChannelMapper.UPDATE_OPEN_RELEASE, (): void => {
      const releaseUrl = params.updateService.getStatus().releaseUrl

      if (!releaseUrl?.startsWith('https://github.com/')) {
        return
      }

      void shell.openExternal(releaseUrl)
    })

    ipcMain.handle(IpcChannelMapper.USAGE_GET_SNAPSHOT, (): UsageSnapshot => {
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
      async (_event, rawParams: unknown): Promise<AppSettings> => {
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
