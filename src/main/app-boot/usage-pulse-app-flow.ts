import { AppFlow } from '@beecode/msh-app-boot'

import { AppWindowLifeCycle } from '#src/main/app-boot/app-window-life-cycle'
import { IpcRegistrationLifeCycle } from '#src/main/app-boot/ipc-registration-life-cycle'
import { SessionsPollLifeCycle } from '#src/main/app-boot/sessions-poll-life-cycle'
import { SettingsLifeCycle } from '#src/main/app-boot/settings-life-cycle'
import { UpdateCheckLifeCycle } from '#src/main/app-boot/update-check-life-cycle'
import { UsagePollLifeCycle } from '#src/main/app-boot/usage-poll-life-cycle'
import { type SettingsRepo } from '#src/main/business/repo/settings-repo'
import { type TriggerRunLogRepo } from '#src/main/business/repo/trigger-run-log-repo'
import { type SchedulingService } from '#src/main/business/service/scheduling-service'
import { type SessionsPollService } from '#src/main/business/service/sessions-poll-service'
import { type SessionsService } from '#src/main/business/service/sessions-service'
import { type SshSessionsService } from '#src/main/business/service/ssh-sessions-service'
import { type UpdateService } from '#src/main/business/service/update-service'
import { type UsagePollService } from '#src/main/business/service/usage-poll-service'
import { type SettingsUseCase } from '#src/main/business/use-case/settings-use-case'

export class UsagePulseAppFlow extends AppFlow {
  constructor(params: {
    pollService: UsagePollService
    schedulingService: SchedulingService
    sessionsPollService: SessionsPollService
    sessionsService: SessionsService
    settingsRepo: SettingsRepo
    settingsUseCase: SettingsUseCase
    sshSessionsService: SshSessionsService
    triggerRunLogRepo: TriggerRunLogRepo
    updateService: UpdateService
  }) {
    const settingsLifeCycle = new SettingsLifeCycle({
      schedulingService: params.schedulingService,
      settingsRepo: params.settingsRepo,
    })
    const appWindowLifeCycle = new AppWindowLifeCycle({
      onVisibilityChange: ({ isVisible }) => {
        params.pollService.setWindowVisibility({ isVisible })
        params.sessionsPollService.setWindowVisibility({ isVisible })
      },
    })
    const ipcRegistrationLifeCycle = new IpcRegistrationLifeCycle({
      appWindowLifeCycle,
      pollService: params.pollService,
      schedulingService: params.schedulingService,
      sessionsPollService: params.sessionsPollService,
      sessionsService: params.sessionsService,
      settingsUseCase: params.settingsUseCase,
      sshSessionsService: params.sshSessionsService,
      triggerRunLogRepo: params.triggerRunLogRepo,
      updateService: params.updateService,
    })

    super(settingsLifeCycle, appWindowLifeCycle, ipcRegistrationLifeCycle, [
      new SessionsPollLifeCycle({ sessionsPollService: params.sessionsPollService, settingsLifeCycle }),
      new UpdateCheckLifeCycle({ updateService: params.updateService }),
      new UsagePollLifeCycle({ pollService: params.pollService, settingsLifeCycle }),
    ])
  }
}
