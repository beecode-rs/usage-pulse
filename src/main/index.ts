import { app, dialog } from 'electron'

import { DesktopApp } from '#src/main/app-boot/desktop-app'
import { TriggerRunnerService } from '#src/main/business/service/trigger-runner-service'
import { devDesktopEntry } from '#src/main/lib/dev-desktop-entry'
import { errorUtil } from '#src/main/util/error-util'
import { NoSandboxReexecUtil } from '#src/main/util/no-sandbox-reexec-util'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'
import { ScheduleTriggerRunSourceMapper } from '#src/shared/business/enum/schedule-trigger-run-source-mapper-enum'

const resolveFiredTriggerId = (): string | undefined => {
  const flagIndex = process.argv.indexOf('--fire-trigger')

  if (flagIndex < 0) {
    return undefined
  }

  return process.argv[flagIndex + 1]
}

const bootstrapTriggerWorker = (params: { triggerId: string }): void => {
  const { triggerId } = params
  app.dock?.hide()

  void new TriggerRunnerService()
    .runTrigger({ source: ScheduleTriggerRunSourceMapper.OS_SCHEDULE, triggerId })
    .then(({ exitCode }) => {
      app.exit(exitCode)
    })
    .catch(() => {
      app.exit(1)
    })
}

const noSandboxReexecUtil = new NoSandboxReexecUtil()

const shouldReexecWithoutSandbox = (): boolean => {
  return (
    osUtil.resolvePlatform() === OS.LINUX &&
    app.isPackaged &&
    !process.argv.includes('--no-sandbox') &&
    !noSandboxReexecUtil.isDone
  )
}

const reexecWithoutSandbox = (): void => {
  noSandboxReexecUtil.markDone()
  app.relaunch({ args: [...process.argv.slice(1), '--no-sandbox'] })
  app.exit(0)
}

const bootstrapApp = async (): Promise<void> => {
  app.on('window-all-closed', () => {
    app.quit()
  })

  devDesktopEntry.install()

  await new DesktopApp().create()
}

const handleBootstrapError = (error: unknown): void => {
  dialog.showErrorBox('Usage Pulse failed to start', errorUtil.resolveMessage(error))
  app.quit()
}

if (shouldReexecWithoutSandbox()) {
  reexecWithoutSandbox()
} else if (process.argv.includes('--fire-trigger')) {
  const firedTriggerId = resolveFiredTriggerId()

  if (firedTriggerId === undefined) {
    app.exit(1)
  } else {
    bootstrapTriggerWorker({ triggerId: firedTriggerId })
  }
} else {
  void app.whenReady().then(bootstrapApp).catch(handleBootstrapError)
}
