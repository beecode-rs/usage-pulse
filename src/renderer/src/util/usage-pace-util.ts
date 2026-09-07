import { usageResetUtil } from '#src/renderer/src/util/usage-reset-util'

const OUTPACING_MIN_DRIFT_PERCENT = 10
const PACE_ON_PACE_BAND_PERCENT = 5
const PACE_STEP_MAX_COUNT = 5
const PACE_STEP_PERCENT = 20

export class UsagePaceUtil {
  resolveIsUsageOutpacingWindow(params: {
    now: number
    resetAt?: number
    usedPercent: number
    windowMs: number
  }): boolean {
    const diffPercent = this._resolveDiffPercent(params)

    if (diffPercent === undefined) {
      return false
    }

    return diffPercent >= OUTPACING_MIN_DRIFT_PERCENT
  }

  resolvePaceColor(params: {
    now: number
    resetAt?: number
    usedPercent: number
    windowMs: number
  }): string | undefined {
    const diffPercent = this._resolveDiffPercent(params)

    if (diffPercent === undefined) {
      return undefined
    }

    return this._resolvePaceColorForDiff({ diffPercent })
  }

  protected _resolveDiffPercent(params: {
    now: number
    resetAt?: number
    usedPercent: number
    windowMs: number
  }): number | undefined {
    const { now, resetAt, usedPercent, windowMs } = params

    if (resetAt === undefined) {
      return undefined
    }

    const remainingMs = usageResetUtil.resolveRemainingMs({ now, resetAt })
    const elapsedPercent = usageResetUtil.resolveElapsedPercent({ remainingMs, windowMs })

    return usedPercent - elapsedPercent
  }

  protected _resolvePaceColorForDiff(params: { diffPercent: number }): string {
    const { diffPercent } = params

    if (Math.abs(diffPercent) <= PACE_ON_PACE_BAND_PERCENT) {
      return 'var(--meter-accent)'
    }

    const stepCount = this._resolvePaceStepCount({ diffPercent })

    if (diffPercent > 0) {
      return this._resolvePaceStepColorVar({ paceDirection: 'red', stepCount })
    }

    return this._resolvePaceStepColorVar({ paceDirection: 'green', stepCount })
  }

  protected _resolvePaceStepColorVar(params: { paceDirection: 'green' | 'red'; stepCount: number }): string {
    const { paceDirection, stepCount } = params

    return `var(--pace-${paceDirection}-${String(stepCount)})`
  }

  protected _resolvePaceStepCount(params: { diffPercent: number }): number {
    const { diffPercent } = params

    const driftBeyondBandPercent = Math.abs(diffPercent) - PACE_ON_PACE_BAND_PERCENT

    return Math.min(Math.ceil(driftBeyondBandPercent / PACE_STEP_PERCENT), PACE_STEP_MAX_COUNT)
  }
}
