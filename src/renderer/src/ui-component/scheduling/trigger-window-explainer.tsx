import type { ReactElement } from 'react'

import { TriggerPlannerService } from '#src/renderer/src/business/service/trigger-planner-service'
import { dayTimeMsUtil } from '#src/renderer/src/util/day-time-ms-util'
import { constant } from '#src/shared/util/constant'

const triggerPlannerService = new TriggerPlannerService()

interface TimeRange {
  endMs: number
  startMs: number
}

interface WindowSegment extends TimeRange {
  startTime: string
}

const DIAGRAM_DOMAIN_MS: TimeRange = { endMs: 82_800_000, startMs: 21_600_000 }

const DIAGRAM_TICKS: string[] = ['07:00', '12:00', '17:00', '22:00']

const WORK_RANGE: TimeRange = { endMs: 64_800_000, startMs: 36_000_000 }

const WORK_RANGE_LABEL = 'Work 10:00–18:00'

const WINDOW_MS = constant.fiveHourWindowMs

const resolvePositionPercent = (params: { dayMs: number }): number => {
  const { dayMs } = params
  const domainMs = DIAGRAM_DOMAIN_MS.endMs - DIAGRAM_DOMAIN_MS.startMs
  const offsetMs = dayMs - DIAGRAM_DOMAIN_MS.startMs

  return (offsetMs / domainMs) * 100
}

const resolveSegmentLayout = (params: { range: TimeRange }): { leftPercent: number; widthPercent: number } => {
  const { range } = params
  const leftPercent = resolvePositionPercent({ dayMs: range.startMs })
  const rightPercent = resolvePositionPercent({ dayMs: range.endMs })

  return { leftPercent, widthPercent: rightPercent - leftPercent }
}

const resolveWindowSegments = (): WindowSegment[] => {
  return constant.maxWindowScheduleTriggerPreset.times.map((startTime) => {
    const startMs = dayTimeMsUtil.resolveDayMs(startTime)

    return {
      endMs: startMs + WINDOW_MS,
      startMs,
      startTime,
    }
  })
}

const resolveWindowSentence = (): string => {
  return resolveWindowSegments()
    .map((segment) => {
      const endTime = triggerPlannerService.formatDayMs({ dayMs: segment.endMs })

      return `${segment.startTime} → ${endTime}`
    })
    .join(', ')
}

export const TriggerWindowExplainer = (): ReactElement => {
  const windowSegments = resolveWindowSegments()
  const workLayout = resolveSegmentLayout({ range: WORK_RANGE })

  return (
    <div className="trigger-explainer">
      <button
        aria-describedby="trigger-window-explainer-tip"
        aria-label="How the max 5h windows preset works"
        className="trigger-icon-button"
        title="How the max 5h windows preset works"
        type="button"
      >
        <svg
          fill="none"
          height="14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
          viewBox="0 0 16 16"
          width="14"
        >
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7.5v3.5" />
          <path d="M8 4.8v0.01" />
        </svg>
      </button>
      <div className="trigger-explainer-popup" id="trigger-window-explainer-tip" role="tooltip">
        <p className="trigger-explainer-title">Making the most of 5-hour windows</p>
        <p className="trigger-explainer-text">
          Plan usage is measured in 5-hour windows. The first prompt starts a window, and the quota resets when it
          expires.
        </p>
        <div className="trigger-window-diagram">
          <div className="trigger-window-diagram-lane">
            {windowSegments.map((segment) => {
              const layout = resolveSegmentLayout({ range: segment })

              return (
                <div
                  className="trigger-window-diagram-bar"
                  key={segment.startTime}
                  style={{
                    left: `${String(layout.leftPercent)}%`,
                    width: `${String(layout.widthPercent)}%`,
                  }}
                >
                  {segment.startTime}
                </div>
              )
            })}
          </div>
          <div className="trigger-window-diagram-lane">
            <div
              className="trigger-window-diagram-bar is-work"
              style={{
                left: `${String(workLayout.leftPercent)}%`,
                width: `${String(workLayout.widthPercent)}%`,
              }}
            >
              {WORK_RANGE_LABEL}
            </div>
          </div>
          <div className="trigger-window-diagram-ticks">
            {DIAGRAM_TICKS.map((tick) => {
              const leftPercent = resolvePositionPercent({ dayMs: dayTimeMsUtil.resolveDayMs(tick) })

              return (
                <span className="trigger-window-diagram-tick" key={tick} style={{ left: `${String(leftPercent)}%` }}>
                  {tick}
                </span>
              )
            })}
          </div>
        </div>
        <p className="trigger-explainer-text">
          Each trigger restarts the window: {resolveWindowSentence()}. The small gaps make sure the previous window has
          fully expired, so every run starts a fresh one.
        </p>
        <p className="trigger-explainer-text">
          If you work 10:00–18:00, your workday spans all three windows — fresh quota for the morning, midday and late
          afternoon — and the 17:05 window keeps covering the evening until 22:05.
        </p>
      </div>
    </div>
  )
}
