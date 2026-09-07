const STORAGE_KEY = 'side-menu.is-collapsed'

export const sideMenuPrefsUtil = {
  loadIsCollapsed: (): boolean => {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  },
  saveIsCollapsed: (params: { isCollapsed: boolean }): void => {
    const { isCollapsed } = params
    window.localStorage.setItem(STORAGE_KEY, String(isCollapsed))
  },
}
