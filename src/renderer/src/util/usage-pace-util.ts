import { constant } from '#src/renderer/src/util/constant'
import { usageResetUtil } from '#src/renderer/src/util/usage-reset-util'

export class UsagePaceUtil {
  isUsageOutpacingWindow(params: { now: number; resetAt?: number; usedPercent: number; windowMs: number }): boolean {
    const diffPercent = this._resolveDiffPercent(params)

    if (diffPercent === undefined) {
      return false
    }

    return diffPercent >= constant.usagePace.minDriftPercent
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

    if (Math.abs(diffPercent) <= constant.usagePace.onPaceBandPercent) {
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

    const driftBeyondBandPercent = Math.abs(diffPercent) - constant.usagePace.onPaceBandPercent

    return Math.min(Math.ceil(driftBeyondBandPercent / constant.usagePace.stepPercent), constant.usagePace.maxStepCount)
  }
}
