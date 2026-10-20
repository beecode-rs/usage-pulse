import type { ReactElement } from 'react'

import { RefreshIcon } from '#src/renderer/src/ui-component/icon/refresh-icon'

export const SessionsRefreshButton = (props: { label: string; onClick: () => void }): ReactElement => {
  const { label, onClick } = props

  return (
    <button aria-label={label} className="sessions-icon-button" onClick={onClick} title={label} type="button">
      <RefreshIcon />
    </button>
  )
}
