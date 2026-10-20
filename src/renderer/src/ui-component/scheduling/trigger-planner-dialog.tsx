import { type ReactElement, useState } from 'react'

import { PlannerDialToneMapper } from '#src/renderer/src/business/enum/planner-dial-tone-mapper-enum'
import { TriggerPlannerService } from '#src/renderer/src/business/service/trigger-planner-service'
import { SchedulingPlannerDial } from '#src/renderer/src/ui-component/scheduling/planner-dial'
import { constant } from '#src/renderer/src/util/constant'
import { type ScheduleTriggerPreset } from '#src/shared/business/model/schedule-trigger-model'
import { type PlannerWindow } from '#src/shared/business/model/trigger-planner-model'
import { constant as sharedConstant } from '#src/shared/util/constant'

const triggerPlannerService = new TriggerPlannerService()

const formatHourDialValue = (hour: number): string => {
  return triggerPlannerService.formatDayMs({ dayMs: hour * 3_600_000 })
}

const formatWorkDurationDialValue = (hours: number): string => {
  return `${String(hours)}h`
}

const resolvePercent = (dayMs: number): number => {
  return (dayMs / sharedConstant.planner.dayMs) * 100
}

const resolveBarLayout = (params: {
  endMs: number
  startMs: number
}): { leftPercent: number; widthPercent: number } => {
  const { endMs, startMs } = params
  const clippedEndMs = Math.min(endMs, sharedConstant.planner.dayMs)
  const clippedStartMs = Math.max(startMs, 0)

  return {
    leftPercent: resolvePercent(clippedStartMs),
    widthPercent: resolvePercent(clippedEndMs - clippedStartMs),
  }
}

const resolveBarHourMarks = (params: { endMs: number; startMs: number }): number[] => {
  const { endMs, startMs } = params
  const clippedStartMs = Math.max(startMs, 0)
  const clippedEndMs = Math.min(endMs, sharedConstant.planner.dayMs)
  const spanMs = clippedEndMs - clippedStartMs

  if (spanMs <= 3_600_000) {
    return []
  }

  const markCount = Math.ceil(spanMs / 3_600_000) - 1

  return Array.from({ length: markCount }, (_, index) => {
    return (((index + 1) * 3_600_000) / spanMs) * 100
  })
}

const resolveTickClassName = (dayMs: number): string => {
  if (dayMs === 0) {
    return 'window-planner-tick is-first'
  }

  if (dayMs === sharedConstant.planner.dayMs) {
    return 'window-planner-tick is-last'
  }

  return 'window-planner-tick'
}

const resolveWindowBarLabel = (window: PlannerWindow): string => {
  if (window.endMs <= sharedConstant.planner.dayMs) {
    return window.startTime
  }

  return `${window.startTime} → ${triggerPlannerService.formatDayMs({ dayMs: window.endMs })}`
}

const renderBarHourMarks = (params: { endMs: number; startMs: number }): ReactElement[] => {
  return resolveBarHourMarks(params).map((leftPercent, index) => {
    return (
      <span
        className="window-planner-hour-mark"
        key={`hour-mark-${String(index)}`}
        style={{ left: `${String(leftPercent)}%` }}
      />
    )
  })
}

const resolveWindowsSentence = (windows: PlannerWindow[]): string => {
  return windows
    .map((window) => {
      return `${window.startTime} → ${triggerPlannerService.formatDayMs({ dayMs: window.endMs })}`
    })
    .join(', ')
}

export const SchedulingTriggerPlannerDialog = (props: {
  onClose: () => void
  onCreateTrigger: (preset: ScheduleTriggerPreset) => void
}): ReactElement => {
  const { onClose, onCreateTrigger } = props
  const [firstTriggerMs, setFirstTriggerMs] = useState(sharedConstant.planner.firstTrigger.defaultMs)
  const [lunchStartMs, setLunchStartMs] = useState(sharedConstant.planner.lunchStart.defaultMs)
  const [workDurationMs, setWorkDurationMs] = useState(sharedConstant.planner.workDuration.defaultMs)
  const [workStartMs, setWorkStartMs] = useState(sharedConstant.planner.workStart.defaultMs)

  const lunchEndMs = lunchStartMs + sharedConstant.planner.lunchDurationMs
  const workEndMs = workStartMs + workDurationMs
  const windows = triggerPlannerService.resolvePlannerWindows({ firstTriggerMs, workEndMs })
  const coverageHint = triggerPlannerService.resolveCoverageHint({ windows, workEndMs, workStartMs })
  const workBarLayout = resolveBarLayout({ endMs: workEndMs, startMs: workStartMs })
  const lunchBarLayout = resolveBarLayout({ endMs: lunchEndMs, startMs: lunchStartMs })
  const lunchBarTitle = `Lunch ${triggerPlannerService.formatDayMs({ dayMs: lunchStartMs })}–${triggerPlannerService.formatDayMs({ dayMs: lunchEndMs })}`
  const workBarTitle = `Work ${triggerPlannerService.formatDayMs({ dayMs: workStartMs })}–${triggerPlannerService.formatDayMs({ dayMs: workEndMs })}`

  const handleCreateTrigger = (): void => {
    onCreateTrigger({
      days: [...sharedConstant.maxWindowScheduleTriggerPreset.days],
      times: triggerPlannerService.resolveTriggerTimes({ windows }),
    })
  }

  const handleLunchStartHourChange = (hour: number): void => {
    setLunchStartMs(hour * 3_600_000)
  }

  const handleWorkDurationHoursChange = (hours: number): void => {
    setWorkDurationMs(hours * 3_600_000)
  }

  const handleWorkStartHourChange = (hour: number): void => {
    setWorkStartMs(hour * 3_600_000)
  }

  return (
    <div className="settings-overlay">
      <section className="settings-panel window-planner-panel">
        <header className="settings-panel-header">
          <h2 className="settings-panel-title">Plan 5-hour windows</h2>
          <button className="button" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="settings-panel-body">
          <p className="trigger-explainer-text">
            Pick when the first Claude prompt fires — each window lasts exactly 5 hours and the next one starts a few
            minutes after the previous expires.
          </p>
          <div className="window-planner-dials">
            <SchedulingPlannerDial
              formatValue={formatHourDialValue}
              label="Work start"
              max={23}
              min={0}
              onChange={handleWorkStartHourChange}
              step={1}
              tone={PlannerDialToneMapper.WORK}
              value={workStartMs / 3_600_000}
            />
            <SchedulingPlannerDial
              formatValue={formatWorkDurationDialValue}
              label="Work hours"
              max={16}
              min={1}
              onChange={handleWorkDurationHoursChange}
              step={1}
              tone={PlannerDialToneMapper.WORK}
              value={workDurationMs / 3_600_000}
            />
            <SchedulingPlannerDial
              formatValue={formatHourDialValue}
              label="Lunch start"
              max={23}
              min={0}
              onChange={handleLunchStartHourChange}
              step={1}
              tone={PlannerDialToneMapper.LUNCH}
              value={lunchStartMs / 3_600_000}
            />
          </div>
          <label className="settings-field">
            <span className="settings-field-label">
              First trigger — {triggerPlannerService.formatDayMs({ dayMs: firstTriggerMs })}
            </span>
            <input
              className="window-planner-range"
              max={constant.planner.firstTrigger.maxMs}
              min={0}
              onChange={(event) => {
                setFirstTriggerMs(Number.parseInt(event.target.value, 10))
              }}
              step={constant.planner.firstTrigger.stepMs}
              type="range"
              value={firstTriggerMs}
            />
            <span className="settings-hint">Local time on weekdays, in 15-minute steps.</span>
          </label>
          <div className="window-planner-timeline">
            <div className="window-planner-lane">
              {windows.map((window) => {
                const layout = resolveBarLayout({ endMs: window.endMs, startMs: window.startMs })

                return (
                  <div
                    className="window-planner-bar"
                    key={window.startTime}
                    style={{
                      left: `${String(layout.leftPercent)}%`,
                      width: `${String(layout.widthPercent)}%`,
                    }}
                  >
                    {renderBarHourMarks({ endMs: window.endMs, startMs: window.startMs })}
                    {resolveWindowBarLabel(window)}
                  </div>
                )
              })}
            </div>
            <div className="window-planner-lane">
              <div
                className="window-planner-bar is-work"
                style={{
                  left: `${String(workBarLayout.leftPercent)}%`,
                  width: `${String(workBarLayout.widthPercent)}%`,
                }}
                title={workBarTitle}
              >
                {renderBarHourMarks({ endMs: workEndMs, startMs: workStartMs })}
                {workBarTitle}
              </div>
              <div
                className="window-planner-bar is-lunch"
                style={{
                  left: `${String(lunchBarLayout.leftPercent)}%`,
                  width: `${String(lunchBarLayout.widthPercent)}%`,
                }}
                title={lunchBarTitle}
              />
            </div>
            <div className="window-planner-ticks">
              {constant.planner.timelineTicks.map((tick) => {
                return (
                  <span
                    className={resolveTickClassName(tick.dayMs)}
                    key={tick.label}
                    style={{ left: `${String(resolvePercent(tick.dayMs))}%` }}
                  >
                    {tick.label}
                  </span>
                )
              })}
            </div>
          </div>
          {windows.length > 0 && (
            <p className="trigger-explainer-text">
              Each trigger starts a 5-hour window: {resolveWindowsSentence(windows)}.
            </p>
          )}
          {coverageHint !== undefined && <p className="window-planner-hint">{coverageHint}</p>}
        </div>
        <div className="settings-dialog-actions">
          <button
            className="button button-primary"
            disabled={windows.length === 0}
            onClick={handleCreateTrigger}
            type="button"
          >
            Create trigger
          </button>
        </div>
      </section>
    </div>
  )
}
