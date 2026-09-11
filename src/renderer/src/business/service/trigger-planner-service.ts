import { type PlannerWindow } from '#src/shared/business/model/trigger-planner-model'
import { constant } from '#src/shared/util/constant'

const FIRST_WINDOW_GAP_MS = 18_120_000

export class TriggerPlannerService {
  formatDayMs(params: { dayMs: number }): string {
    const wrappedDayMs = ((params.dayMs % constant.planner.dayMs) + constant.planner.dayMs) % constant.planner.dayMs
    const hours = Math.floor(wrappedDayMs / 3_600_000)
    const minutesPastHour = Math.floor((wrappedDayMs % 3_600_000) / 60_000)

    return `${String(hours).padStart(2, '0')}:${String(minutesPastHour).padStart(2, '0')}`
  }

  resolveCoverageHint(params: {
    windows: PlannerWindow[]
    workEndMs: number
    workStartMs: number
  }): string | undefined {
    const firstWindow = params.windows.at(0)
    const lastWindow = params.windows.at(-1)

    if (firstWindow === undefined || lastWindow === undefined) {
      return 'No window fits before work ends — slide the first trigger earlier.'
    }

    const isFirstTooLate = firstWindow.startMs >= params.workStartMs
    const isLastTooEarly = lastWindow.endMs <= params.workEndMs

    if (isFirstTooLate && isLastTooEarly) {
      return 'The windows miss the edges of your workday — slide the first trigger so the first window starts before work and the last one ends after it.'
    }

    if (isFirstTooLate) {
      return 'The first window starts at or after work start — slide the first trigger a bit earlier.'
    }

    if (isLastTooEarly) {
      return 'The last window ends at or before work end — slide the first trigger a bit later.'
    }

    return undefined
  }

  resolvePlannerWindows(params: { firstTriggerMs: number; workEndMs: number }): PlannerWindow[] {
    const startLimitMs = Math.min(params.workEndMs, constant.planner.dayMs)

    return this._collectWindows({ gapIndex: 0, startLimitMs, startMs: params.firstTriggerMs, windows: [] })
  }

  resolveTriggerTimes(params: { windows: PlannerWindow[] }): string[] {
    return params.windows.map((window) => {
      return window.startTime
    })
  }

  protected _collectWindows(step: {
    gapIndex: number
    startLimitMs: number
    startMs: number
    windows: PlannerWindow[]
  }): PlannerWindow[] {
    if (step.startMs >= step.startLimitMs) {
      return step.windows
    }

    const collectedWindow: PlannerWindow = {
      endMs: step.startMs + constant.planner.windowDurationMs,
      startMs: step.startMs,
      startTime: this.formatDayMs({ dayMs: step.startMs }),
    }

    return this._collectWindows({
      gapIndex: step.gapIndex + 1,
      startLimitMs: step.startLimitMs,
      startMs: step.startMs + FIRST_WINDOW_GAP_MS + step.gapIndex * 60_000,
      windows: [...step.windows, collectedWindow],
    })
  }
}
