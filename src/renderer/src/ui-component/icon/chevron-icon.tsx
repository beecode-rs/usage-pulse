import type { ReactElement } from 'react'

const DEFAULT_ICON_SIZE = 15

export const ChevronIcon = (props: { size?: number }): ReactElement => {
  const { size = DEFAULT_ICON_SIZE } = props

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
