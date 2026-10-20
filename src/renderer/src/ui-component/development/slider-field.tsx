import { type ChangeEvent, type ReactElement } from 'react'

import '#src/renderer/src/ui-component/development/slider-field.css'

export const DevelopmentSliderField = (props: {
  label: string
  max: number
  onChange: (value: number) => void
  value: number
  valueText: string
}): ReactElement => {
  const { label, max, onChange, value, valueText } = props

  const handleOnChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(Number(event.target.value))
  }

  return (
    <div className="slider-field">
      <div className="slider-field-header">
        <span className="slider-field-label">{label}</span>
        <span className="slider-field-value">{valueText}</span>
      </div>
      <input
        aria-label={label}
        className="slider-field-input"
        max={max}
        min={0}
        onChange={handleOnChange}
        type="range"
        value={value}
      />
    </div>
  )
}
