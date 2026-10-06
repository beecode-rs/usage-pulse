export const appTitleUtil = {
  resolve(params: { isDev: boolean }): string {
    const { isDev } = params
    if (isDev) {
      return 'Usage Pulse (dev)'
    }

    return 'Usage Pulse'
  },
}
