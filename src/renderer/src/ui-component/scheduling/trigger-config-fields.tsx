import type { ReactElement } from 'react'

import { DayTimeScheduleFields } from '#src/renderer/src/ui-component/schedule/day-time-schedule-fields'
import { type ScheduleTriggerConfig } from '#src/shared/business/model/schedule-trigger-model'
import { constant } from '#src/shared/util/constant'

export const TriggerConfigFields = (props: {
  config: ScheduleTriggerConfig
  onChange: (config: ScheduleTriggerConfig) => void
}): ReactElement => {
  const { config, onChange } = props

  return (
    <>
      <label className="settings-field">
        <span className="settings-field-label">Display name</span>
        <input
          className="settings-field-input"
          onChange={(event) => {
            onChange({ ...config, name: event.target.value })
          }}
          placeholder="Trigger"
          type="text"
          value={config.name}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Command</span>
        <input
          className="settings-field-input trigger-command-input"
          onChange={(event) => {
            onChange({ ...config, command: event.target.value })
          }}
          placeholder='claude -p "what is your name, only name"'
          type="text"
          value={config.command}
        />
        <span className="settings-hint">Full shell command the trigger runs each time it fires.</span>
      </label>
      <DayTimeScheduleFields
        days={config.days}
        onChange={({ days, times }) => {
          onChange({ ...config, days, times })
        }}
        times={config.times}
      />
      <label className="settings-field">
        <span className="settings-field-label">Timeout (minutes)</span>
        <input
          className="settings-field-input"
          max={constant.scheduleTrigger.timeout.maxMs / 60_000}
          min={constant.scheduleTrigger.timeout.minMs / 60_000}
          onChange={(event) => {
            const minutes = Number.parseInt(event.target.value, 10)

            if (!Number.isFinite(minutes)) {
              return
            }

            const clampedMinutes = Math.min(
              Math.max(minutes, constant.scheduleTrigger.timeout.minMs / 60_000),
              constant.scheduleTrigger.timeout.maxMs / 60_000,
            )

            onChange({ ...config, timeoutMs: clampedMinutes * 60_000 })
          }}
          type="number"
          value={Math.round(config.timeoutMs / 60_000)}
        />
        <span className="settings-hint">Used when the trigger command runs.</span>
      </label>
      <div className="settings-field">
        <span className="settings-field-label">Enabled</span>
        <label className="trigger-toggle">
          <input
            checked={config.isEnabled}
            onChange={(event) => {
              onChange({ ...config, isEnabled: event.target.checked })
            }}
            type="checkbox"
          />
          Register with the OS scheduler
        </label>
      </div>
    </>
  )
}
