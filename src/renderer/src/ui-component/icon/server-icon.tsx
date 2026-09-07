import type { ReactElement } from 'react'

const DEFAULT_ICON_SIZE = 15

export const ServerIcon = (props: { size?: number }): ReactElement => {
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
      <rect height="8" rx="2" ry="2" width="20" x="2" y="2" />
      <rect height="8" rx="2" ry="2" width="20" x="2" y="14" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  )
}
