import { AppFlow } from '@beecode/msh-app-boot'

import { AppWindowLifeCycle } from '#src/main/app-boot/life-cycle/app-window-life-cycle'
import { IpcRegistrationLifeCycle } from '#src/main/app-boot/life-cycle/ipc-registration-life-cycle'
import { RxjsBusLifeCycle } from '#src/main/app-boot/life-cycle/rxjs-bus-life-cycle'
import { SessionsPollLifeCycle } from '#src/main/app-boot/life-cycle/sessions-poll-life-cycle'
import { SettingsLifeCycle } from '#src/main/app-boot/life-cycle/settings-life-cycle'
import { UpdateCheckLifeCycle } from '#src/main/app-boot/life-cycle/update-check-life-cycle'
import { UsagePollLifeCycle } from '#src/main/app-boot/life-cycle/usage-poll-life-cycle'

export class UsagePulseAppFlow extends AppFlow {
  constructor() {
    super(new SettingsLifeCycle(), new AppWindowLifeCycle(), new IpcRegistrationLifeCycle(), new RxjsBusLifeCycle(), [
      new SessionsPollLifeCycle(),
      new UpdateCheckLifeCycle(),
      new UsagePollLifeCycle(),
    ])
  }
}
