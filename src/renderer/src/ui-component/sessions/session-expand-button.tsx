import type { ReactElement } from 'react'

import { ChevronIcon } from '#src/renderer/src/ui-component/icon/chevron-icon'

export const SessionExpandButton = (props: {
  isExpanded: boolean
  label: string
  onClick: () => void
}): ReactElement => {
  const { isExpanded, label, onClick } = props
  const className = resolveClassName({ isExpanded })

  return (
    <button
      aria-expanded={isExpanded}
      aria-label={label}
      className={className}
      onClick={onClick}
      title={label}
      type="button"
    >
      <ChevronIcon />
    </button>
  )
}

const resolveClassName = (params: { isExpanded: boolean }): string => {
  const { isExpanded } = params
  if (isExpanded) {
    return 'session-expand-button is-expanded'
  }

  return 'session-expand-button'
}
