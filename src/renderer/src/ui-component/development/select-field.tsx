import { type ChangeEvent, type ReactElement } from 'react'

import '#src/renderer/src/ui-component/development/select-field.css'

export type SelectFieldOption = {
  label: string
  value: string
}

export const SelectField = (props: {
  label: string
  onChange: (value: string) => void
  options: SelectFieldOption[]
  value: string
}): ReactElement => {
  const { label, onChange, options, value } = props

  const handleOnChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    onChange(event.target.value)
  }

  return (
    <div className="select-field">
      <div className="select-field-header">
        <span className="select-field-label">{label}</span>
      </div>
      <select aria-label={label} className="select-field-input" onChange={handleOnChange} value={value}>
        {options.map((option) => {
          return (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          )
        })}
      </select>
    </div>
  )
}
