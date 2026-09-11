import type {
  SessionFocusSupport,
  SessionSnapshot,
  SessionsUpdateListener,
} from '#src/shared/business/model/session-model'

export const sessionsClientService = {
  focusSession: (params: { cwd: string; pid: number }): Promise<void> => {
    return window.usageApi.focusSession(params)
  },
  getSessionFocusSupport: (): Promise<SessionFocusSupport> => {
    return window.usageApi.getSessionFocusSupport()
  },
  getSessionsSnapshot: (): Promise<SessionSnapshot | undefined> => {
    return window.usageApi.getSessionsSnapshot()
  },
  installSessionFocusTool: (): Promise<SessionFocusSupport> => {
    return window.usageApi.installSessionFocusTool()
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
    return window.usageApi.onSessionsUpdate(params.onUpdate)
  },
  testSshHost: (params: { url: string }): Promise<void> => {
    return window.usageApi.testSshHost(params)
  },
}
