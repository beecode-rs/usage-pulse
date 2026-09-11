import { dateUtil } from '#src/renderer/src/util/date-util'
import { constant } from '#src/shared/util/constant'

export const usageResetUtil = {
  fiveHourWindowMs: constant.fiveHourWindowMs,

  resolveElapsedPercent: (params: { remainingMs: number; windowMs: number }): number => {
    const elapsedFraction = 1 - params.remainingMs / params.windowMs

    return Math.min(Math.max(elapsedFraction, 0), 1) * 100
  },

  resolveRemainingMs: (params: { now: number; resetAt?: number }): number => {
    if (params.resetAt === undefined) {
      return 0
    }

    return Math.max(0, params.resetAt - params.now)
  },

  resolveRemainingPercent: (params: { remainingMs: number; windowMs: number }): number => {
    const remainingFraction = params.remainingMs / params.windowMs

    return Math.min(Math.max(remainingFraction, 0), 1) * 100
  },

  resolveRemainingText: (params: { remainingMs: number }): string => {
    if (params.remainingMs <= 0) {
      return 'now'
    }

    return dateUtil.formatDuration(params.remainingMs)
  },
}
