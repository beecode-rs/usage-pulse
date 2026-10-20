import { app, dialog } from 'electron'

import { DesktopApp } from '#src/main/app-boot/desktop-app'
import { devDesktopEntry } from '#src/main/lib/dev-desktop-entry'
import { errorUtil } from '#src/shared/util/error-util'

export const appBootstrap = {
  handleError(error: unknown): void {
    dialog.showErrorBox('Usage Pulse failed to start', errorUtil.resolveMessage(error))
    app.quit()
  },

  async run(): Promise<void> {
    app.on('window-all-closed', () => {
      app.quit()
    })

    devDesktopEntry.install()

    const desktopApp = new DesktopApp()

    // best-effort teardown while quit proceeds: clears timers/listeners synchronously; process exit forces the rest
    app.on('will-quit', () => {
      void desktopApp.destroy()
    })

    await desktopApp.create()
  },
}
