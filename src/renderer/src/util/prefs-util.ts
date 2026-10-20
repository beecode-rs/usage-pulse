export const prefsUtil = {
  loadBoolean: (params: { key: string }): boolean => {
    const { key } = params

    return window.localStorage.getItem(key) === 'true'
  },
  saveBoolean: (params: { isSet: boolean; key: string }): void => {
    const { isSet, key } = params

    window.localStorage.setItem(key, String(isSet))
  },
}
