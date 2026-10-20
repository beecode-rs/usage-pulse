import type { ReactElement } from 'react'

import { constant } from '#src/renderer/src/util/constant'

export const ChevronIcon = (props: { size?: number }): ReactElement => {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
