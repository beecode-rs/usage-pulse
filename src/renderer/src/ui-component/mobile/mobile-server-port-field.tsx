import { type ReactElement } from 'react'

import { constant } from '#src/shared/util/constant'

export const MobileServerPortField = (props: {
  onPortTextChange: (portText: string) => void
  onPortTextCommit: (params: { portText: string }) => void
  portText: string
}): ReactElement => {
  const { onPortTextChange, onPortTextCommit, portText } = props

  return (
    <label className="settings-field">
      <span className="settings-field-label">Port</span>
      <input
        className="settings-field-input"
        max={constant.mobileServer.maxPort}
        min={constant.mobileServer.minPort}
        onChange={(event) => {
          onPortTextChange(event.target.value)
        }}
        onBlur={(event) => {
          onPortTextCommit({ portText: event.target.value })
        }}
        type="number"
        value={portText}
      />
      <span className="settings-hint">
        The port the mobile server listens on, between {String(constant.mobileServer.minPort)} and{' '}
        {String(constant.mobileServer.maxPort)}.
      </span>
    </label>
  )
}
