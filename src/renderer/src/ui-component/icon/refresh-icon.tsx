import type { ReactElement } from 'react'

import { constant } from '#src/renderer/src/util/constant'

export const RefreshIcon = (props: { size?: number }): ReactElement => {
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
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  )
}
