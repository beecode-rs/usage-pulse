import { ipcMain, shell } from 'electron'

import { triggerRunLogRepoSingleton } from '#src/main/business/repo/trigger-run-log-repo-singleton'
import { schedulingServiceSingleton } from '#src/main/business/service/scheduling-service-singleton'
import { sessionsPollServiceSingleton } from '#src/main/business/service/sessions-poll-service-singleton'
import { sessionsServiceSingleton } from '#src/main/business/service/sessions-service-singleton'
import { sshSessionsServiceSingleton } from '#src/main/business/service/ssh-sessions-service-singleton'
import { updateServiceSingleton } from '#src/main/business/service/update-service-singleton'
import { usagePollServiceSingleton } from '#src/main/business/service/usage-poll-service-singleton'
import { settingsUseCaseSingleton } from '#src/main/business/use-case/settings-use-case-singleton'
import { appWindowStoreSingleton } from '#src/main/lib/app-window-store-singleton'
import { objectUtil } from '#src/main/util/object-util'
import { osUtil } from '#src/main/util/os-util'
import { IpcChannelMapper } from '#src/shared/business/enum/ipc-channel-mapper-enum'
import { type OS } from '#src/shared/business/enum/os-enum'
import {
  type ScheduleTriggerRegistrationHealth,
  type ScheduleTriggerRunLogEntry,
  type SchedulingInfo,
} from '#src/shared/business/model/schedule-trigger-model'
import { type SessionSnapshot } from '#src/shared/business/model/session-model'
import { type AppSettings } from '#src/shared/business/model/settings-model'
import { type UpdateStatus } from '#src/shared/business/model/update-model'
import { type UsageSnapshot } from '#src/shared/business/model/usage-model'

export class IpcController {
  protected readonly _pollService = usagePollServiceSingleton()
  protected readonly _schedulingService = schedulingServiceSingleton()
  protected readonly _sessionsPollService = sessionsPollServiceSingleton()
  protected readonly _sessionsService = sessionsServiceSingleton()
  protected readonly _settingsUseCase = settingsUseCaseSingleton()
  protected readonly _sshSessionsService = sshSessionsServiceSingleton()
  protected readonly _triggerRunLogRepo = triggerRunLogRepoSingleton()
  protected readonly _updateService = updateServiceSingleton()

  register(): void {
    this._registerOsHandlers()
    this._registerSchedulingHandlers()
    this._registerSessionsHandlers()
    this._registerSettingsHandlers()
    this._registerTriggerHandlers()
    this._registerUpdateHandlers()
    this._registerUsageHandlers()
    this._registerEventForwarders()
  }

  protected _registerOsHandlers(): void {
    ipcMain.handle(IpcChannelMapper.OS_GET_PLATFORM, (): OS => {
      return osUtil.resolvePlatform()
    })
  }

  protected _registerSchedulingHandlers(): void {
    ipcMain.handle(IpcChannelMapper.SCHEDULING_GET_INFO, (): SchedulingInfo => {
      return this._schedulingService.getSchedulingInfo()
    })

    ipcMain.handle(
      IpcChannelMapper.SCHEDULING_SET_ENABLED,
      async (_event, rawParams: unknown): Promise<AppSettings> => {
        const rawRecord = objectUtil.asRecord(rawParams)
        const isEnabled = rawRecord?.['isEnabled']

        if (typeof isEnabled !== 'boolean') {
          return await this._settingsUseCase.loadSettings()
        }

        return await this._settingsUseCase.setSchedulingEnabled({ isEnabled })
      },
    )
  }

  protected _registerSessionsHandlers(): void {
    ipcMain.handle(IpcChannelMapper.SESSIONS_FOCUS, async (_event, rawParams: unknown): Promise<void> => {
      const rawRecord = objectUtil.asRecord(rawParams)
      const pid = rawRecord?.['pid']
      const cwd = rawRecord?.['cwd']

      if (typeof pid !== 'number' || typeof cwd !== 'string') {
        return
      }

      await this._sessionsService.focusSession({ cwd, pid })
    })

    ipcMain.handle(IpcChannelMapper.SESSIONS_GET_FOCUS_SUPPORT, (): Promise<boolean> => {
      return this._sessionsService.isFocusSupported()
    })

    ipcMain.handle(IpcChannelMapper.SESSIONS_GET_SNAPSHOT, (): SessionSnapshot | undefined => {
      return this._sessionsPollService.getSnapshot()
    })

    ipcMain.handle(IpcChannelMapper.SESSIONS_INSTALL_FOCUS_TOOL, (): Promise<void> => {
      return this._sessionsService.installFocusTool()
    })

    ipcMain.handle(IpcChannelMapper.SESSIONS_LIST, async (): Promise<SessionSnapshot> => {
      return await this._sessionsPollService.refreshNow()
    })

    ipcMain.handle(IpcChannelMapper.SESSIONS_TEST_SSH_HOST, async (_event, rawParams: unknown): Promise<void> => {
      const rawRecord = objectUtil.asRecord(rawParams)
      const url = rawRecord?.['url']

      if (typeof url !== 'string' || url.trim() === '') {
        throw new Error('an ssh host url is required')
      }

      await this._sshSessionsService.testHost({ url })
    })
  }

  protected _registerSettingsHandlers(): void {
    ipcMain.handle(IpcChannelMapper.SETTINGS_GET, async (): Promise<AppSettings> => {
      return await this._settingsUseCase.loadSettings()
    })

    ipcMain.handle(IpcChannelMapper.SETTINGS_SAVE, async (_event, rawSettings: unknown): Promise<AppSettings> => {
      return await this._settingsUseCase.saveSettings({ rawSettings })
    })
  }

  protected _registerTriggerHandlers(): void {
    ipcMain.handle(IpcChannelMapper.TRIGGER_CLEAR_RUN_LOGS, async (_event, rawParams: unknown): Promise<void> => {
      const rawRecord = objectUtil.asRecord(rawParams)
      const triggerId = rawRecord?.['triggerId']

      if (typeof triggerId !== 'string') {
        return
      }

      await this._triggerRunLogRepo.removeByTriggerId({ triggerId })
    })

    ipcMain.handle(
      IpcChannelMapper.TRIGGER_GET_RUN_LOGS,
      async (_event, rawParams: unknown): Promise<ScheduleTriggerRunLogEntry[]> => {
        const rawRecord = objectUtil.asRecord(rawParams)
        const triggerId = rawRecord?.['triggerId']

        if (typeof triggerId !== 'string') {
          return []
        }

        return await this._triggerRunLogRepo.listByTriggerId({ triggerId })
      },
    )

    ipcMain.handle(IpcChannelMapper.TRIGGER_OS_INSPECT, async (): Promise<ScheduleTriggerRegistrationHealth[]> => {
      const settings = await this._settingsUseCase.loadSettings()

      return await this._schedulingService.inspectRegistrations({ settings })
    })

    ipcMain.handle(IpcChannelMapper.TRIGGER_SET_ENABLED, async (_event, rawParams: unknown): Promise<AppSettings> => {
      const rawRecord = objectUtil.asRecord(rawParams)
      const triggerId = rawRecord?.['triggerId']
      const isEnabled = rawRecord?.['isEnabled']

      if (typeof triggerId !== 'string' || typeof isEnabled !== 'boolean') {
        return await this._settingsUseCase.loadSettings()
      }

      return await this._settingsUseCase.setTriggerEnabled({ isEnabled, triggerId })
    })
  }

  protected _registerUpdateHandlers(): void {
    ipcMain.handle(IpcChannelMapper.UPDATE_GET_STATUS, (): UpdateStatus => {
      return this._updateService.getStatus()
    })

    ipcMain.on(IpcChannelMapper.UPDATE_OPEN_RELEASE, (): void => {
      const releaseUrl = this._updateService.getStatus().releaseUrl

      if (!releaseUrl?.startsWith('https://github.com/')) {
        return
      }

      void shell.openExternal(releaseUrl)
    })
  }

  protected _registerUsageHandlers(): void {
    ipcMain.handle(IpcChannelMapper.USAGE_GET_SNAPSHOT, (): UsageSnapshot => {
      return this._pollService.getSnapshot()
    })

    ipcMain.handle(IpcChannelMapper.USAGE_REFRESH, async (): Promise<void> => {
      await this._pollService.refreshNow()
    })

    ipcMain.handle(IpcChannelMapper.USAGE_REFRESH_TRACKER, async (_event, trackerId: unknown): Promise<void> => {
      if (typeof trackerId !== 'string') {
        return
      }

      await this._pollService.refreshTracker({ trackerId })
    })

    ipcMain.handle(
      IpcChannelMapper.USAGE_SET_TRACKER_PAUSED,
      async (_event, rawParams: unknown): Promise<AppSettings> => {
        const rawRecord = objectUtil.asRecord(rawParams)
        const trackerId = rawRecord?.['trackerId']
        const isAutoRefreshPaused = rawRecord?.['isAutoRefreshPaused']

        if (typeof trackerId !== 'string' || typeof isAutoRefreshPaused !== 'boolean') {
          return await this._settingsUseCase.loadSettings()
        }

        return await this._settingsUseCase.setTrackerPaused({ isAutoRefreshPaused, trackerId })
      },
    )
  }

  protected _registerEventForwarders(): void {
    this._pollService.onUpdate({
      listener: (snapshot) => {
        appWindowStoreSingleton().sendToRenderer({ channel: IpcChannelMapper.USAGE_UPDATE, payload: snapshot })
      },
    })

    this._sessionsPollService.onUpdate({
      listener: (snapshot) => {
        appWindowStoreSingleton().sendToRenderer({ channel: IpcChannelMapper.SESSIONS_UPDATE, payload: snapshot })
      },
    })

    this._settingsUseCase.onSave({
      listener: ({ settings }) => {
        appWindowStoreSingleton().sendToRenderer({ channel: IpcChannelMapper.SETTINGS_UPDATE, payload: settings })
      },
    })

    this._updateService.onUpdate({
      listener: (status) => {
        appWindowStoreSingleton().sendToRenderer({ channel: IpcChannelMapper.UPDATE_STATUS, payload: status })
      },
    })
  }
}
