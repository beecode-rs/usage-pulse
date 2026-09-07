import type { ReactElement } from 'react'

const DEFAULT_ICON_SIZE = 15

export const PlayIcon = (props: { size?: number }): ReactElement => {
  const { size = DEFAULT_ICON_SIZE } = props

  return (
    <svg fill="none" height={size} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width={size}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  )
}
