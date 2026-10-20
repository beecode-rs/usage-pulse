import { constant } from '#src/renderer/src/util/constant'
import { prefsUtil } from '#src/renderer/src/util/prefs-util'

export const developmentPrefsUtil = {
  loadIsUnlocked: (): boolean => {
    return prefsUtil.loadBoolean({ key: constant.localStorage.developmentIsUnlockedKey })
  },
  saveIsUnlocked: (params: { isUnlocked: boolean }): void => {
    const { isUnlocked } = params

    prefsUtil.saveBoolean({ isSet: isUnlocked, key: constant.localStorage.developmentIsUnlockedKey })
  },
}
