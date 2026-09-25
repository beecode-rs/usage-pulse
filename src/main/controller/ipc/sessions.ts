import { type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'

import { sessionsPollServiceSingleton } from '#src/main/business/service/sessions-poll-service-singleton'
import { sessionsServiceSingleton } from '#src/main/business/service/sessions-service-singleton'
import { sshSessionsServiceSingleton } from '#src/main/business/service/ssh-sessions-service-singleton'
import { validationUtil } from '#src/main/util/validation-util'
import { type SessionSnapshot } from '#src/shared/business/model/session-model'

const sessionsFocusParamsSchema = z.object({ cwd: z.string(), pid: z.number() })
const sessionsTestSshHostParamsSchema = z.object({
  url: z.string().trim().min(1, { message: 'an ssh host url is required' }),
})

export const ipcSessions = {
  focus: async (_event: IpcMainInvokeEvent, rawParams: unknown): Promise<void> => {
    const { cwd, pid } = validationUtil.parse(rawParams, sessionsFocusParamsSchema)

    await sessionsServiceSingleton().focusSession({ cwd, pid })
  },

  getSnapshot: (): SessionSnapshot | undefined => {
    return sessionsPollServiceSingleton().getSnapshot()
  },

  installFocusTool: (): Promise<void> => {
    return sessionsServiceSingleton().installFocusTool()
  },

  isFocusSupported: (): Promise<boolean> => {
    return sessionsServiceSingleton().isFocusSupported()
  },

  list: async (): Promise<SessionSnapshot> => {
    return await sessionsPollServiceSingleton().refreshNow()
  },

  testSshHost: async (_event: IpcMainInvokeEvent, rawParams: unknown): Promise<void> => {
    const { url } = validationUtil.parse(rawParams, sessionsTestSshHostParamsSchema)

    await sshSessionsServiceSingleton().testHost({ url })
  },
}
