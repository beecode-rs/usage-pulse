const STORAGE_KEY = 'development.is-unlocked'

export const developmentPrefsUtil = {
  loadIsUnlocked: (): boolean => {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  },
  saveIsUnlocked: (params: { isUnlocked: boolean }): void => {
    const { isUnlocked } = params
    window.localStorage.setItem(STORAGE_KEY, String(isUnlocked))
  },
}
