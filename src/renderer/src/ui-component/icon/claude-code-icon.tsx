import type { ReactElement } from 'react'

import { constant } from '#src/renderer/src/util/constant'

export const ClaudeCodeIcon = (props: { size?: number }): ReactElement => {
  const { size = constant.icon.defaultSizePx } = props

  return (
    <svg
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={size}
    >
      <line x1="12" x2="12" y1="3" y2="21" />
      <line x1="3" x2="21" y1="12" y2="12" />
      <line x1="5.6" x2="18.4" y1="5.6" y2="18.4" />
      <line x1="18.4" x2="5.6" y1="5.6" y2="18.4" />
    </svg>
  )
}
