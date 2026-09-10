import { LifeCycle } from '@beecode/msh-app-boot'

import { type AppWindowLifeCycle } from '#src/main/app-boot/app-window-life-cycle'
import { type TriggerRunLogRepo } from '#src/main/business/repo/trigger-run-log-repo'
import { type SchedulingService } from '#src/main/business/service/scheduling-service'
import { type SessionsPollService } from '#src/main/business/service/sessions-poll-service'
import { type SessionsService } from '#src/main/business/service/sessions-service'
import { type SshSessionsService } from '#src/main/business/service/ssh-sessions-service'
import { type UpdateService } from '#src/main/business/service/update-service'
import { type UsagePollService } from '#src/main/business/service/usage-poll-service'
import { type SettingsUseCase } from '#src/main/business/use-case/settings-use-case'
import { ipcController } from '#src/main/controller/ipc-controller'

export class IpcRegistrationLifeCycle extends LifeCycle<void> {
  protected readonly _appWindowLifeCycle: AppWindowLifeCycle
  protected readonly _pollService: UsagePollService
  protected readonly _schedulingService: SchedulingService
  protected readonly _sessionsPollService: SessionsPollService
  protected readonly _sessionsService: SessionsService
  protected readonly _settingsUseCase: SettingsUseCase
  protected readonly _sshSessionsService: SshSessionsService
  protected readonly _triggerRunLogRepo: TriggerRunLogRepo
  protected readonly _updateService: UpdateService

  constructor(params: {
    appWindowLifeCycle: AppWindowLifeCycle
    pollService: UsagePollService
    schedulingService: SchedulingService
    sessionsPollService: SessionsPollService
    sessionsService: SessionsService
    settingsUseCase: SettingsUseCase
    sshSessionsService: SshSessionsService
    triggerRunLogRepo: TriggerRunLogRepo
    updateService: UpdateService
  }) {
    super({ name: 'ipc registration' })
    this._appWindowLifeCycle = params.appWindowLifeCycle
    this._pollService = params.pollService
    this._schedulingService = params.schedulingService
    this._sessionsPollService = params.sessionsPollService
    this._sessionsService = params.sessionsService
    this._settingsUseCase = params.settingsUseCase
    this._sshSessionsService = params.sshSessionsService
    this._triggerRunLogRepo = params.triggerRunLogRepo
    this._updateService = params.updateService
  }

  protected _createFn(): Promise<void> {
    ipcController.register({
      getWindow: () => {
        return this._appWindowLifeCycle.getWindow()
      },
      pollService: this._pollService,
      schedulingService: this._schedulingService,
      sessionsPollService: this._sessionsPollService,
      sessionsService: this._sessionsService,
      settingsUseCase: this._settingsUseCase,
      sshSessionsService: this._sshSessionsService,
      triggerRunLogRepo: this._triggerRunLogRepo,
      updateService: this._updateService,
    })

    return Promise.resolve()
  }

  protected _destroyFn(): Promise<void> {
    return Promise.resolve()
  }
}
