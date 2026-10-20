import type { ReactElement } from 'react'

import { constant } from '#src/renderer/src/util/constant'

export const PlayIcon = (props: { size?: number }): ReactElement => {
  const { size = constant.icon.defaultSizePx } = props

  return (
    <svg fill="none" height={size} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width={size}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  )
}
