import type { ReactElement } from 'react'

import { constant } from '#src/renderer/src/util/constant'

export const OpenCodeIcon = (props: { size?: number }): ReactElement => {
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
      <polyline points="8 6 3 12 8 18" />
      <polyline points="16 6 21 12 16 18" />
      <line x1="13.5" x2="10.5" y1="5" y2="19" />
    </svg>
  )
}
