import { type ReactElement } from 'react'

export const MobileServerToggle = (props: {
  isEnabled: boolean
  onToggle: (isEnabled: boolean) => void
}): ReactElement => {
  const { isEnabled, onToggle } = props

  return (
    <label className="mobile-toggle">
      <input
        aria-label="Enable mobile server"
        checked={isEnabled}
        onChange={(event) => {
          onToggle(event.target.checked)
        }}
        type="checkbox"
      />
      <span className="mobile-toggle-track">
        <span className="mobile-toggle-knob" />
      </span>
    </label>
  )
}
