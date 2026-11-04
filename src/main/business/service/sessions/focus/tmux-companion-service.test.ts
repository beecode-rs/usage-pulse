import { describe, expect, it } from 'vitest'

import { SessionsFocusTmuxCompanionService } from '#src/main/business/service/sessions/focus/tmux-companion-service'

describe('SessionsFocusTmuxCompanionService', () => {
  const service = new SessionsFocusTmuxCompanionService()

  it('builds the local focus request body with the session key', () => {
    expect(service.resolveFocusRequestBody({ sessionName: 's01' })).toEqual({ session: 's01' })
  })

  it('builds the ssh focus request body with host, port and user', () => {
    expect(
      service.resolveFocusRequestBody({ host: 'remote.example', port: 2222, sessionName: 's02', user: 'deploy' }),
    ).toEqual({ host: 'remote.example', port: 2222, session: 's02', user: 'deploy' })
  })
})
