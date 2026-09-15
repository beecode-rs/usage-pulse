import { SessionsParserService } from '#src/main/business/service/sessions-parser-service'
import { errorUtil } from '#src/main/util/error-util'
import { type SessionInfo } from '#src/shared/business/model/session-model'

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
}
