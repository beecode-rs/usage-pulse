import type { SessionSnapshot, SessionsUpdateListener } from '#src/shared/business/model/session-model'

export const sessionsClientService = {
  focusSession: (params: { cwd: string; pid: number }): Promise<void> => {
    return window.usageApi.focusSession(params)
  },
  getSessionsSnapshot: (): Promise<SessionSnapshot | undefined> => {
    return window.usageApi.getSessionsSnapshot()
  },
  installSessionFocusTool: (): Promise<void> => {
    return window.usageApi.installSessionFocusTool()
  },
  isSessionFocusSupported: (): Promise<boolean> => {
    return window.usageApi.isSessionFocusSupported()
  },
  listSessions: (): Promise<SessionSnapshot> => {
    return window.usageApi.listSessions()
  },
  resolveSessionsSnapshot: (): Promise<SessionSnapshot> => {
    return window.usageApi.getSessionsSnapshot().then((cachedSnapshot) => {
      if (cachedSnapshot !== undefined) {
        return cachedSnapshot
      }

      return window.usageApi.listSessions()
    })
  },
  subscribeToSessionsUpdates: (params: { onUpdate: SessionsUpdateListener }): (() => void) => {
    const { onUpdate } = params

    return window.usageApi.onSessionsUpdate(onUpdate)
  },
  testSshHost: (params: { url: string }): Promise<void> => {
    return window.usageApi.testSshHost(params)
  },
}
