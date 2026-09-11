import { app, dialog } from 'electron'
import { join } from 'node:path'

import { UsagePulseAppFlow } from '#src/main/app-boot/usage-pulse-app-flow'
import { SchedulingStrategyFactory } from '#src/main/business/component/scheduling-strategy/factory'
import { SettingsRepo } from '#src/main/business/repo/settings-repo'
import { TriggerRunLogRepo } from '#src/main/business/repo/trigger-run-log-repo'
import { UsageSnapshotRepo } from '#src/main/business/repo/usage-snapshot-repo'
import { SchedulingService } from '#src/main/business/service/scheduling-service'
import { SessionTranscriptService } from '#src/main/business/service/session-transcript-service'
import { SessionsPollService } from '#src/main/business/service/sessions-poll-service'
import { SessionsService } from '#src/main/business/service/sessions-service'
import { SettingsService } from '#src/main/business/service/settings-service'
import { SshSessionsService } from '#src/main/business/service/ssh-sessions-service'
import { TriggerRunnerService } from '#src/main/business/service/trigger-runner-service'
import { UpdateService } from '#src/main/business/service/update-service'
import { UsagePollService } from '#src/main/business/service/usage-poll-service'
import { SettingsUseCase } from '#src/main/business/use-case/settings-use-case'
import { devDesktopEntry } from '#src/main/lib/dev-desktop-entry'
import { config } from '#src/main/util/config'
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
  app.dock?.hide()

  const userDataPath = app.getPath('userData')
  const runner = new TriggerRunnerService({
    runLogRepo: new TriggerRunLogRepo({
      logFilePath: join(userDataPath, 'usage-pulse-trigger-log.jsonl'),
    }),
    settingsRepo: new SettingsRepo({
      settingsFilePath: join(userDataPath, 'usage-pulse-settings.json'),
    }),
  })

  void runner
    .runTrigger({ source: ScheduleTriggerRunSourceMapper.OS_SCHEDULE, triggerId: params.triggerId })
    .then(({ exitCode }) => {
      app.exit(exitCode)
    })
    .catch(() => {
      app.exit(1)
    })
}

const resolveExecutablePrefixArgs = (): string[] => {
  if (app.isPackaged) {
    return ['--no-sandbox']
  }

  return ['--no-sandbox', app.getAppPath()]
}

const resolveExecutablePath = (): string => {
  return config.appImage ?? process.execPath
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

  const settingsRepo = new SettingsRepo({
    settingsFilePath: join(app.getPath('userData'), 'usage-pulse-settings.json'),
  })
  const usageSnapshotRepo = new UsageSnapshotRepo({
    snapshotFilePath: join(app.getPath('userData'), 'usage-pulse-snapshots.json'),
  })
  const pollService = new UsagePollService({ snapshotRepo: usageSnapshotRepo })
  const schedulingService = new SchedulingService({
    executablePath: resolveExecutablePath(),
    executablePrefixArgs: resolveExecutablePrefixArgs(),
    strategy: new SchedulingStrategyFactory().resolve(),
  })
  const sessionTranscriptService = new SessionTranscriptService()
  const sessionsService = new SessionsService()
  const sshSessionsService = new SshSessionsService()
  const sessionsPollService = new SessionsPollService({
    sessionsService,
    sessionTranscriptService,
    sshSessionsService,
  })
  const triggerRunLogRepo = new TriggerRunLogRepo({
    logFilePath: join(app.getPath('userData'), 'usage-pulse-trigger-log.jsonl'),
  })
  const updateService = new UpdateService({ currentVersion: app.getVersion() })
  const settingsService = new SettingsService()
  const settingsUseCase = new SettingsUseCase({
    pollService,
    schedulingService,
    sessionsPollService,
    settingsRepo,
    settingsService,
  })

  await new UsagePulseAppFlow({
    pollService,
    schedulingService,
    sessionsPollService,
    sessionsService,
    settingsRepo,
    settingsUseCase,
    sshSessionsService,
    triggerRunLogRepo,
    updateService,
  }).create()
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
