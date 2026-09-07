import { dateUtil } from '#src/renderer/src/util/date-util'
import { constant } from '#src/shared/util/constant'

export const usageResetUtil = {
  fiveHourWindowMs: constant.fiveHourWindowMs,

  resolveElapsedPercent: (params: { remainingMs: number; windowMs: number }): number => {
    const { remainingMs, windowMs } = params
    const elapsedFraction = 1 - remainingMs / windowMs

    return Math.min(Math.max(elapsedFraction, 0), 1) * 100
  },

  resolveRemainingMs: (params: { now: number; resetAt?: number }): number => {
    const { now, resetAt } = params
    if (resetAt === undefined) {
      return 0
    }

    return Math.max(0, resetAt - now)
  },

  resolveRemainingPercent: (params: { remainingMs: number; windowMs: number }): number => {
    const { remainingMs, windowMs } = params
    const remainingFraction = remainingMs / windowMs

    return Math.min(Math.max(remainingFraction, 0), 1) * 100
  },

  resolveRemainingText: (params: { remainingMs: number }): string => {
    const { remainingMs } = params
    if (remainingMs <= 0) {
      return 'now'
    }

    return dateUtil.formatDuration(remainingMs)
  },
}
