import type { ReactElement } from 'react'

import '#src/renderer/src/ui-component/schedule/day-time-schedule-fields.css'
import { DayTimeSelect } from '#src/renderer/src/ui-component/schedule/day-time-select'
import { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'
import { constant } from '#src/shared/util/constant'

const TRIGGER_DAY_LABELS: Record<ScheduleTriggerDayMapper, string> = {
  [ScheduleTriggerDayMapper.FRIDAY]: 'Fri',
  [ScheduleTriggerDayMapper.MONDAY]: 'Mon',
  [ScheduleTriggerDayMapper.SATURDAY]: 'Sat',
  [ScheduleTriggerDayMapper.SUNDAY]: 'Sun',
  [ScheduleTriggerDayMapper.THURSDAY]: 'Thu',
  [ScheduleTriggerDayMapper.TUESDAY]: 'Tue',
  [ScheduleTriggerDayMapper.WEDNESDAY]: 'Wed',
}

const WEEKDAY_DAYS: ScheduleTriggerDayMapper[] = [
  ScheduleTriggerDayMapper.MONDAY,
  ScheduleTriggerDayMapper.TUESDAY,
  ScheduleTriggerDayMapper.WEDNESDAY,
  ScheduleTriggerDayMapper.THURSDAY,
  ScheduleTriggerDayMapper.FRIDAY,
]
const WEEKEND_DAYS: ScheduleTriggerDayMapper[] = [ScheduleTriggerDayMapper.SATURDAY, ScheduleTriggerDayMapper.SUNDAY]

export const DayTimeScheduleFields = (props: {
  days: ScheduleTriggerDayMapper[]
  onChange: (schedule: { days: ScheduleTriggerDayMapper[]; times: string[] }) => void
  times: string[]
}): ReactElement => {
  const { days, onChange, times } = props

  const resolveChipClassName = (day: ScheduleTriggerDayMapper): string => {
    if (days.includes(day)) {
      return 'trigger-chip is-active'
    }

    return 'trigger-chip'
  }

  const handleToggleDay = (day: ScheduleTriggerDayMapper): void => {
    const selectedDays = new Set(days)

    if (selectedDays.has(day)) {
      selectedDays.delete(day)
    } else {
      selectedDays.add(day)
    }

    onChange({
      days: constant.scheduleTrigger.days.filter((candidateDay) => {
        return selectedDays.has(candidateDay)
      }),
      times,
    })
  }

  const handleSelectDays = (selectedDays: ScheduleTriggerDayMapper[]): void => {
    onChange({ days: selectedDays, times })
  }

  const handleTimeChange = (index: number, time: string): void => {
    onChange({
      days,
      times: times.map((currentTime, currentIndex) => {
        if (currentIndex !== index) {
          return currentTime
        }

        return time
      }),
    })
  }

  const handleTimeRemove = (index: number): void => {
    onChange({
      days,
      times: times.filter((_time, currentIndex) => {
        return currentIndex !== index
      }),
    })
  }

  const handleAddTime = (): void => {
    onChange({ days, times: [...times, '09:00'] })
  }

  return (
    <>
      <div className="settings-field">
        <span className="settings-field-label">Days</span>
        <div className="trigger-card-chips">
          {constant.scheduleTrigger.days.map((day) => {
            return (
              <button
                className={resolveChipClassName(day)}
                key={day}
                onClick={() => {
                  handleToggleDay(day)
                }}
                type="button"
              >
                {TRIGGER_DAY_LABELS[day]}
              </button>
            )
          })}
        </div>
        <div className="trigger-quick-actions">
          <button
            className="button"
            onClick={() => {
              handleSelectDays(WEEKDAY_DAYS)
            }}
            type="button"
          >
            Weekdays
          </button>
          <button
            className="button"
            onClick={() => {
              handleSelectDays(WEEKEND_DAYS)
            }}
            type="button"
          >
            Weekend
          </button>
          <button
            className="button"
            onClick={() => {
              handleSelectDays([...constant.scheduleTrigger.days])
            }}
            type="button"
          >
            Every day
          </button>
        </div>
      </div>
      <div className="settings-field">
        <span className="settings-field-label">Times</span>
        {times.map((time, index) => {
          return (
            <div className="trigger-time-row" key={`${time}-${String(index)}`}>
              <DayTimeSelect
                onChange={(nextTime) => {
                  handleTimeChange(index, nextTime)
                }}
                time={time}
              />
              <button
                className="button"
                onClick={() => {
                  handleTimeRemove(index)
                }}
                type="button"
              >
                Remove
              </button>
            </div>
          )
        })}
        <button className="button" onClick={handleAddTime} type="button">
          Add time
        </button>
        <span className="settings-hint">Local time on the selected days, e.g. 09:00.</span>
      </div>
    </>
  )
}
