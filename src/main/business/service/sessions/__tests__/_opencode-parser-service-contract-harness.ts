import { sortedJsonUtil } from '#src/main/business/service/sessions/__tests__/_sorted-json-util'
import { SessionsOpenCodeParserService } from '#src/main/business/service/sessions/opencode-parser-service'
import { type SessionInfo } from '#src/shared/business/model/session-model'
import { errorUtil } from '#src/shared/util/error-util'

type ParseRemoteEnvelopeOutcome = {
  activeJson: string
  formsJson: string
  permissionsJson: string
  sessionsJson: string
  tuiDirectoriesJson: string
}
type ParseSessionsOutcome = { errorMessage: string } | { sessions: SessionInfo[] }

const contractNowMs = 1792768656239

export const sessionsOpenCodeParserServiceContractHarness = {
  parseRemoteEnvelope: (params: { stdout: string }): ParseRemoteEnvelopeOutcome => {
    const { stdout } = params
    const payload = new SessionsOpenCodeParserService().parseRemoteEnvelope({ stdout })

    return {
      activeJson: sortedJsonUtil.stringify({ value: payload.active }),
      formsJson: sortedJsonUtil.stringify({ value: payload.forms }),
      permissionsJson: sortedJsonUtil.stringify({ value: payload.permissions }),
      sessionsJson: sortedJsonUtil.stringify({ value: payload.sessions }),
      tuiDirectoriesJson: sortedJsonUtil.stringify({ value: payload.tuiDirectories }),
    }
  },
  parseSessions: (params: {
    active: unknown
    nowMs?: number
    sessions: unknown
    tuiDirectories?: string[]
  }): ParseSessionsOutcome => {
    const { active, nowMs, sessions, tuiDirectories } = params

    try {
      return {
        sessions: new SessionsOpenCodeParserService().parseSessions({
          active,
          nowMs: nowMs ?? contractNowMs,
          sessions,
          tuiDirectories,
        }),
      }
    } catch (error) {
      return { errorMessage: errorUtil.resolveMessage(error) }
    }
  },
}
