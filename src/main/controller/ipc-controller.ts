import { ipcMain, shell } from 'electron'
import { z } from 'zod'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { triggerRunLogRepoSingleton } from '#src/main/business/repo/trigger-run-log-repo-singleton'
import { schedulingServiceSingleton } from '#src/main/business/service/scheduling-service-singleton'
import { sessionsPollServiceSingleton } from '#src/main/business/service/sessions-poll-service-singleton'
import { sessionsServiceSingleton } from '#src/main/business/service/sessions-service-singleton'
import { sshSessionsServiceSingleton } from '#src/main/business/service/ssh-sessions-service-singleton'
import { updateServiceSingleton } from '#src/main/business/service/update-service-singleton'
import { usagePollServiceSingleton } from '#src/main/business/service/usage-poll-service-singleton'
import { osUtil } from '#src/main/util/os-util'
import { validationUtil } from '#src/main/util/validation-util'
import { IpcChannelMapper } from '#src/shared/business/enum/ipc-channel-mapper-enum'
import { type OS } from '#src/shared/business/enum/os-enum'
import {
  type ScheduleTriggerRegistrationHealth,
  type ScheduleTriggerRunLogEntry,
  type SchedulingInfo,
} from '#src/shared/business/model/schedule-trigger-model'
import { type SessionSnapshot } from '#src/shared/business/model/session-model'
import { type SettingsModel } from '#src/shared/business/model/settings-model'
import { type UpdateStatus } from '#src/shared/business/model/update-model'
import { type UsageSnapshot } from '#src/shared/business/model/usage-model'

const schedulingSetEnabledParamsSchema = z.object({ isEnabled: z.boolean() })
const sessionsFocusParamsSchema = z.object({ cwd: z.string(), pid: z.number() })
const sessionsTestSshHostParamsSchema = z.object({
  url: z.string().trim().min(1, { message: 'an ssh host url is required' }),
})
const triggerRunLogsParamsSchema = z.object({ triggerId: z.string() })
const triggerSetEnabledParamsSchema = z.object({ isEnabled: z.boolean(), triggerId: z.string() })
const usageRefreshTrackerParamsSchema = z.string()
const usageSetTrackerPausedParamsSchema = z.object({ isAutoRefreshPaused: z.boolean(), trackerId: z.string() })

export class IpcController {
  protected readonly _pollService = usagePollServiceSingleton()
  protected readonly _schedulingService = schedulingServiceSingleton()
  protected readonly _settingsRepo = settingsRepoSingleton()
  protected readonly _sessionsPollService = sessionsPollServiceSingleton()
  protected readonly _sessionsService = sessionsServiceSingleton()
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
      async (_event, rawParams: unknown): Promise<SettingsModel> => {
        const { isEnabled } = validationUtil.parse(rawParams, schedulingSetEnabledParamsSchema)
        const settings = this._settingsRepo.fetch().withSchedulingEnabled({ isEnabled })

        await this._settingsRepo.save({ settings })

        return settings
      },
    )
  }

  protected _registerSessionsHandlers(): void {
    ipcMain.handle(IpcChannelMapper.SESSIONS_FOCUS, async (_event, rawParams: unknown): Promise<void> => {
      const { cwd, pid } = validationUtil.parse(rawParams, sessionsFocusParamsSchema)

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
      const { url } = validationUtil.parse(rawParams, sessionsTestSshHostParamsSchema)

      await this._sshSessionsService.testHost({ url })
    })
  }

  protected _registerSettingsHandlers(): void {
    ipcMain.handle(IpcChannelMapper.SETTINGS_GET, (): SettingsModel => {
      return this._settingsRepo.fetch()
    })

    ipcMain.handle(IpcChannelMapper.SETTINGS_SAVE, async (_event, rawSettings: unknown): Promise<SettingsModel> => {
      const settings = this._settingsRepo.sanitize({ rawSettings })

      await this._settingsRepo.save({ settings })

      return settings
    })
  }

  protected _registerTriggerHandlers(): void {
    ipcMain.handle(IpcChannelMapper.TRIGGER_CLEAR_RUN_LOGS, async (_event, rawParams: unknown): Promise<void> => {
      const { triggerId } = validationUtil.parse(rawParams, triggerRunLogsParamsSchema)

      await this._triggerRunLogRepo.removeByTriggerId({ triggerId })
    })

    ipcMain.handle(
      IpcChannelMapper.TRIGGER_GET_RUN_LOGS,
      async (_event, rawParams: unknown): Promise<ScheduleTriggerRunLogEntry[]> => {
        const { triggerId } = validationUtil.parse(rawParams, triggerRunLogsParamsSchema)

        return await this._triggerRunLogRepo.listByTriggerId({ triggerId })
      },
    )

    ipcMain.handle(IpcChannelMapper.TRIGGER_OS_INSPECT, async (): Promise<ScheduleTriggerRegistrationHealth[]> => {
      return await this._schedulingService.inspectRegistrations()
    })

    ipcMain.handle(IpcChannelMapper.TRIGGER_SET_ENABLED, async (_event, rawParams: unknown): Promise<SettingsModel> => {
      const { isEnabled, triggerId } = validationUtil.parse(rawParams, triggerSetEnabledParamsSchema)
      const settings = this._settingsRepo.fetch().withTriggerEnabled({ isEnabled, triggerId })

      await this._settingsRepo.save({ settings })

      return settings
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

    ipcMain.handle(IpcChannelMapper.USAGE_REFRESH_TRACKER, async (_event, rawTrackerId: unknown): Promise<void> => {
      const trackerId = validationUtil.parse(rawTrackerId, usageRefreshTrackerParamsSchema)

      await this._pollService.refreshTracker({ trackerId })
    })

    ipcMain.handle(
      IpcChannelMapper.USAGE_SET_TRACKER_PAUSED,
      async (_event, rawParams: unknown): Promise<SettingsModel> => {
        const { isAutoRefreshPaused, trackerId } = validationUtil.parse(rawParams, usageSetTrackerPausedParamsSchema)
        const settings = this._settingsRepo.fetch().withTrackerPaused({ isAutoRefreshPaused, trackerId })

        await this._settingsRepo.save({ settings })

        return settings
      },
    )
  }
}
