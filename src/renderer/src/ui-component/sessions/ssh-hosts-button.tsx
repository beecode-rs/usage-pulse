import type { ReactElement } from 'react'

import { ServerIcon } from '#src/renderer/src/ui-component/icon/server-icon'

export const SessionsSshHostsButton = (props: { label: string; onClick: () => void }): ReactElement => {
  const { label, onClick } = props

  return (
    <button aria-label={label} className="sessions-icon-button" onClick={onClick} title={label} type="button">
      <ServerIcon />
    </button>
  )
}
