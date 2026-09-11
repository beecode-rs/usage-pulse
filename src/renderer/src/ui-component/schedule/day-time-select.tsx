import { type ChangeEvent, type ReactElement } from 'react'

import { TriggerPlannerService } from '#src/renderer/src/business/service/trigger-planner-service'
import { dayTimeMsUtil } from '#src/renderer/src/util/day-time-ms-util'

const triggerPlannerService = new TriggerPlannerService()

const HOUR_OPTIONS = Array.from({ length: 24 }, (_unused, hour) => {
  return String(hour).padStart(2, '0')
})

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_unused, minute) => {
  return String(minute).padStart(2, '0')
})

export const DayTimeSelect = (props: { onChange: (time: string) => void; time: string }): ReactElement => {
  const { onChange, time } = props

  const dayMs = dayTimeMsUtil.resolveDayMs(time)
  const hourValue = String(Math.floor(dayMs / 3_600_000)).padStart(2, '0')
  const minuteValue = String(Math.floor((dayMs % 3_600_000) / 60_000)).padStart(2, '0')

  const handleHourChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const nextHour = Number.parseInt(event.target.value, 10)
    const nextDayMs = nextHour * 3_600_000 + (dayMs % 3_600_000)

    onChange(triggerPlannerService.formatDayMs({ dayMs: nextDayMs }))
  }

  const handleMinuteChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const nextMinute = Number.parseInt(event.target.value, 10)
    const nextDayMs = Math.floor(dayMs / 3_600_000) * 3_600_000 + nextMinute * 60_000

    onChange(triggerPlannerService.formatDayMs({ dayMs: nextDayMs }))
  }

  return (
    <>
      <select aria-label="Hour" className="settings-field-input" onChange={handleHourChange} value={hourValue}>
        {HOUR_OPTIONS.map((hourOption) => {
          return (
            <option key={hourOption} value={hourOption}>
              {hourOption}
            </option>
          )
        })}
      </select>
      <select aria-label="Minute" className="settings-field-input" onChange={handleMinuteChange} value={minuteValue}>
        {MINUTE_OPTIONS.map((minuteOption) => {
          return (
            <option key={minuteOption} value={minuteOption}>
              {minuteOption}
            </option>
          )
        })}
      </select>
    </>
  )
}
