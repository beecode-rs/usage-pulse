import { SessionsParserService } from '#src/main/business/service/sessions/parser-service'
import { type SessionInfo } from '#src/shared/business/model/session-model'
import { errorUtil } from '#src/shared/util/error-util'

type ParseOutcome = { errorMessage: string } | { sessions: SessionInfo[] }

export const sessionsParserServiceContractHarness = {
  parseSessionEntries: (params: { stdout: string }): ParseOutcome => {
    const { stdout } = params

    try {
      return { sessions: new SessionsParserService().parseSessionEntries({ stdout }) }
    } catch (error) {
      return { errorMessage: errorUtil.resolveMessage(error) }
    }
  },
  sortSessions: (params: { sessions: SessionInfo[] }): string[] => {
    const { sessions } = params

    return new SessionsParserService().sortSessions({ sessions }).map((session) => {
      return `${session.provider}|${session.name}`
    })
  },
}
