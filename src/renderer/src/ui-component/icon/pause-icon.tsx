import type { ReactElement } from 'react'

const DEFAULT_ICON_SIZE = 15

export const PauseIcon = (props: { size?: number }): ReactElement => {
  const { size = DEFAULT_ICON_SIZE } = props

  return (
    <svg fill="none" height={size} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width={size}>
      <line x1="9" x2="9" y1="5" y2="19" />
      <line x1="15" x2="15" y1="5" y2="19" />
    </svg>
  )
}
