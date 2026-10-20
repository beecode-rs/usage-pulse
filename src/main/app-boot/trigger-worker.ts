import { app } from 'electron'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { TriggerRunnerService } from '#src/main/business/service/trigger-runner-service'
import { ScheduleTriggerRunSourceMapper } from '#src/shared/business/enum/schedule-trigger-run-source-mapper-enum'

export const triggerWorker = {
  bootstrap(params: { triggerId: string }): void {
    const { triggerId } = params
    app.dock?.hide()

    void settingsRepoSingleton()
      .init()
      .then(() => {
        return new TriggerRunnerService().runTrigger({ source: ScheduleTriggerRunSourceMapper.OS_SCHEDULE, triggerId })
      })
      .then(({ exitCode }) => {
        app.exit(exitCode)
      })
      .catch(() => {
        app.exit(1)
      })
  },

  resolveFiredTriggerId(): string | undefined {
    const flagIndex = process.argv.indexOf('--fire-trigger')

    if (flagIndex < 0) {
      return undefined
    }

    return process.argv[flagIndex + 1]
  },
}
