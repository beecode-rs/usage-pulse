import type { ReactElement } from 'react'

import { LocalIcon } from '#src/renderer/src/ui-component/icon/local-icon'
import { ServerIcon } from '#src/renderer/src/ui-component/icon/server-icon'

export const SessionsSessionOriginIcon = (props: { isRemote: boolean }): ReactElement => {
  const { isRemote } = props

  if (isRemote) {
    return <ServerIcon />
  }

  return <LocalIcon />
}
