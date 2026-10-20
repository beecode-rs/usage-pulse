import { app } from 'electron'

import { appBootstrap } from '#src/main/app-boot/app-bootstrap'
import { triggerWorker } from '#src/main/app-boot/trigger-worker'
import { NoSandboxReexecUtil } from '#src/main/util/no-sandbox-reexec-util'

const noSandboxReexecUtil = new NoSandboxReexecUtil()

if (noSandboxReexecUtil.isRequired()) {
  noSandboxReexecUtil.reexec()
} else if (process.argv.includes('--fire-trigger')) {
  const firedTriggerId = triggerWorker.resolveFiredTriggerId()

  if (firedTriggerId === undefined) {
    app.exit(1)
  } else {
    triggerWorker.bootstrap({ triggerId: firedTriggerId })
  }
} else {
  void app
    .whenReady()
    .then(() => {
      return appBootstrap.run()
    })
    .catch((error: unknown) => {
      appBootstrap.handleError(error)
    })
}
