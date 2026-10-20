import type { ReactElement } from 'react'

import { GearIcon } from '#src/renderer/src/ui-component/icon/gear-icon'

export const SessionsSettingsButton = (props: { label: string; onClick: () => void }): ReactElement => {
  const { label, onClick } = props

  return (
    <button aria-label={label} className="sessions-icon-button" onClick={onClick} title={label} type="button">
      <GearIcon />
    </button>
  )
}
