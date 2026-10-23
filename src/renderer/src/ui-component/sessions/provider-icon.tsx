import { typeUtil } from '@beecode/msh-util'
import type { ReactElement } from 'react'

import { ClaudeCodeIcon } from '#src/renderer/src/ui-component/icon/claude-code-icon'
import { OpenCodeIcon } from '#src/renderer/src/ui-component/icon/opencode-icon'
import { SessionProviderMapper } from '#src/shared/business/enum/session-provider-mapper-enum'

export const SessionsProviderIcon = (props: { provider: SessionProviderMapper; size?: number }): ReactElement => {
  const { provider, size } = props

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
