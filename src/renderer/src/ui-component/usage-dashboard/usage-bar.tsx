import { type CSSProperties, type ReactElement } from 'react'

import { usageSeverityService } from '#src/renderer/src/business/service/usage-severity-service'

export const UsageDashboardUsageBar = (props: {
  ariaLabel?: string
  fillAnchor?: 'left' | 'right'
  fillColor?: string
  label: string
  percent: number
  valueText?: string
  valueTooltip?: string
}): ReactElement => {
  const { ariaLabel, fillAnchor, fillColor, label, percent, valueText, valueTooltip } = props
  const clampedPercent = Math.min(Math.max(percent, 0), 100)
  const resolvedAriaLabel = ariaLabel ?? `${label} usage`
  const resolvedFillColor = fillColor ?? usageSeverityService.resolveSeverityColorVar(clampedPercent)
  const resolvedValueText = valueText ?? `${String(Math.round(clampedPercent))}%`

  const resolveFillStyle = (): CSSProperties => {
    const fillWidth = `${String(clampedPercent)}%`

    if (fillAnchor === 'right') {
      return { backgroundColor: resolvedFillColor, marginLeft: 'auto', width: fillWidth }
    }

    return { backgroundColor: resolvedFillColor, width: fillWidth }
  }

  return (
    <div
      aria-label={resolvedAriaLabel}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(clampedPercent)}
      className="usage-bar"
      role="meter"
    >
      <div className="usage-bar-header">
        <span className="usage-bar-label">{label}</span>
        <span className="usage-bar-value" data-tooltip={valueTooltip}>
          {resolvedValueText}
        </span>
      </div>
      <div className="usage-bar-track">
        <div className="usage-bar-fill" style={resolveFillStyle()} />
      </div>
    </div>
  )
}
