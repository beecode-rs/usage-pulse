import { typeUtil } from '@beecode/msh-util'
import type { ReactElement } from 'react'

import '#src/renderer/src/ui-component/sessions/provider-icon.css'
import { ClaudeCodeIcon } from '#src/renderer/src/ui-component/icon/claude-code-icon'
import { OpenCodeIcon } from '#src/renderer/src/ui-component/icon/opencode-icon'
import { SessionProviderMapper } from '#src/shared/business/enum/session-provider-mapper-enum'

const resolveProviderIcon = (params: { provider: SessionProviderMapper; size?: number }): ReactElement => {
  const { provider, size } = params

  switch (provider) {
    case SessionProviderMapper.CLAUDE_CODE: {
      return <ClaudeCodeIcon size={size} />
    }

    case SessionProviderMapper.OPENCODE: {
      return <OpenCodeIcon size={size} />
    }

    default: {
      throw typeUtil.exhaustiveError('unsupported session provider [provider]', provider)
    }
  }
}

export const SessionsProviderIcon = (props: { provider: SessionProviderMapper; size?: number }): ReactElement => {
  const { provider, size } = props

  return (
    <span className={`session-provider-icon session-provider-icon-${provider}`}>
      {resolveProviderIcon({ provider, size })}
    </span>
  )
}
