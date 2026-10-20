import type { ReactElement } from 'react'

import { constant } from '#src/renderer/src/util/constant'

export const PauseIcon = (props: { size?: number }): ReactElement => {
  const { size = constant.icon.defaultSizePx } = props

  return (
    <svg fill="none" height={size} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width={size}>
      <line x1="9" x2="9" y1="5" y2="19" />
      <line x1="15" x2="15" y1="5" y2="19" />
    </svg>
  )
}
