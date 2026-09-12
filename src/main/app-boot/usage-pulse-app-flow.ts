import { AppFlow } from '@beecode/msh-app-boot'

import { AppWindowLifeCycle } from '#src/main/app-boot/app-window-life-cycle'
import { IpcRegistrationLifeCycle } from '#src/main/app-boot/ipc-registration-life-cycle'
import { SessionsPollLifeCycle } from '#src/main/app-boot/sessions-poll-life-cycle'
import { SettingsLifeCycle } from '#src/main/app-boot/settings-life-cycle'
import { UpdateCheckLifeCycle } from '#src/main/app-boot/update-check-life-cycle'
import { UsagePollLifeCycle } from '#src/main/app-boot/usage-poll-life-cycle'
import { type _SettingsRepo } from '#src/main/business/repo/settings-repo-singleton'
import { type _SchedulingService } from '#src/main/business/service/scheduling-service-singleton'
import { type _SessionsPollService } from '#src/main/business/service/sessions-poll-service-singleton'
import { type _UpdateService } from '#src/main/business/service/update-service-singleton'
import { type _UsagePollService } from '#src/main/business/service/usage-poll-service-singleton'

export class UsagePulseAppFlow extends AppFlow {
  constructor(params: {
    pollService: _UsagePollService
    schedulingService: _SchedulingService
    sessionsPollService: _SessionsPollService
    settingsRepo: _SettingsRepo
    updateService: _UpdateService
  }) {
    const { pollService, schedulingService, sessionsPollService, settingsRepo, updateService } = params
    const settingsLifeCycle = new SettingsLifeCycle({
      schedulingService,
      settingsRepo,
    })
    const appWindowLifeCycle = new AppWindowLifeCycle({
      onVisibilityChange: ({ isVisible }) => {
        pollService.setWindowVisibility({ isVisible })
        sessionsPollService.setWindowVisibility({ isVisible })
      },
    })
    const ipcRegistrationLifeCycle = new IpcRegistrationLifeCycle()

    super(settingsLifeCycle, appWindowLifeCycle, ipcRegistrationLifeCycle, [
      new SessionsPollLifeCycle({ sessionsPollService, settingsLifeCycle }),
      new UpdateCheckLifeCycle({ updateService }),
      new UsagePollLifeCycle({ pollService, settingsLifeCycle }),
    ])
  }
}
