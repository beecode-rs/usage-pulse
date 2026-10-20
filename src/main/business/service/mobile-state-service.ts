import { sessionsPollServiceSingleton } from '#src/main/business/service/sessions/poll-service-singleton'
import { usagePollServiceSingleton } from '#src/main/business/service/usage-poll-service-singleton'
import { type MobileStateResponse } from '#src/shared/business/model/mobile-api-model'

export const mobileStateService = {
  getSnapshot: (): MobileStateResponse => {
    return {
      sessions: sessionsPollServiceSingleton().getSnapshot() ?? null,
      usage: usagePollServiceSingleton().getSnapshot(),
    }
  },
}
