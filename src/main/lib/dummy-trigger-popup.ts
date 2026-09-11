import { app, dialog } from 'electron'

import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'

const POPUP_TITLE = 'Usage Pulse — Dummy tracker'

export const dummyTriggerPopup = {
  show: async (params: { trackerName: string }): Promise<void> => {
    if (osUtil.resolvePlatform() !== OS.MACOS) {
      return
    }

    await app.whenReady()
    await app.dock?.show()

    await dialog.showMessageBox({
      message: `Tracker "${params.trackerName}" was triggered.`,
      title: POPUP_TITLE,
    })
  },
}
