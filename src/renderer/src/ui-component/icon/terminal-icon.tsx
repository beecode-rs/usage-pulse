import type { ReactElement } from 'react'

import { constant } from '#src/renderer/src/util/constant'

export const TerminalIcon = (props: { size?: number }): ReactElement => {
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
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  )
}
