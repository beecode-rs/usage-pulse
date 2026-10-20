import { constant } from '#src/renderer/src/util/constant'
import { prefsUtil } from '#src/renderer/src/util/prefs-util'

export const sideMenuPrefsUtil = {
  loadIsCollapsed: (): boolean => {
    return prefsUtil.loadBoolean({ key: constant.localStorage.sideMenuIsCollapsedKey })
  },
  saveIsCollapsed: (params: { isCollapsed: boolean }): void => {
    const { isCollapsed } = params

    prefsUtil.saveBoolean({ isSet: isCollapsed, key: constant.localStorage.sideMenuIsCollapsedKey })
  },
}
