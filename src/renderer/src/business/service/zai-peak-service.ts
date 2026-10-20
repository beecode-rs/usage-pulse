import { constant } from '#src/renderer/src/util/constant'
import { dateUtil } from '#src/renderer/src/util/date-util'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'

type ZaiPeakInfo = {
  isPeakHour: boolean
  peakWindowText: string
}

export class ZaiPeakService {
  resolvePeakInfo(params: { nowMs: number; providerId: ProviderIdMapper }): ZaiPeakInfo | undefined {
    const { nowMs, providerId } = params
    if (providerId !== ProviderIdMapper.ZAI) {
      return undefined
    }

    const wallClock = this._resolveUtc8WallClock({ nowMs })
    const isWeekday =
      wallClock.weekday >= constant.zaiPeak.weekdayFirst && wallClock.weekday <= constant.zaiPeak.weekdayLast
    const isWithinPeakHours =
      wallClock.minuteOfDay >= constant.zaiPeak.startMinuteOfDay &&
      wallClock.minuteOfDay < constant.zaiPeak.endMinuteOfDay
    const { peakEndMs, peakStartMs } = this._resolvePeakBounds({ nowMs })

    return {
      isPeakHour: isWeekday && isWithinPeakHours,
      peakWindowText: `${dateUtil.formatHourMinute(peakStartMs)}–${dateUtil.formatHourMinute(peakEndMs)}`,
    }
  }

  resolvePeakRemainingPercent(params: { nowMs: number; providerId: ProviderIdMapper }): number | undefined {
    const { nowMs, providerId } = params
    if (providerId !== ProviderIdMapper.ZAI) {
      return undefined
    }

    const { peakEndMs, peakStartMs } = this._resolvePeakBounds({ nowMs })

    return this._resolveWindowRemainingPercent({ nowMs, peakEndMs, peakStartMs })
  }

  resolvePeakRemainingText(params: { nowMs: number; providerId: ProviderIdMapper }): string | undefined {
    const { nowMs, providerId } = params
    if (providerId !== ProviderIdMapper.ZAI) {
      return undefined
    }

    const { peakEndMs } = this._resolvePeakBounds({ nowMs })

    return dateUtil.formatDuration(peakEndMs - nowMs)
  }

  protected _resolvePeakBounds(params: { nowMs: number }): { peakEndMs: number; peakStartMs: number } {
    const { nowMs } = params
    const wallClock = this._resolveUtc8WallClock({ nowMs })

    return {
      peakEndMs: wallClock.dayStartMs + constant.zaiPeak.endMinuteOfDay * 60_000,
      peakStartMs: wallClock.dayStartMs + constant.zaiPeak.startMinuteOfDay * 60_000,
    }
  }

  protected _resolveUtc8WallClock(params: { nowMs: number }): {
    dayStartMs: number
    minuteOfDay: number
    weekday: number
  } {
    const { nowMs } = params
    const shiftedDate = new Date(nowMs + constant.zaiPeak.utcOffsetMinutes * 60_000)
    const utc8DayStartMs = Date.UTC(shiftedDate.getUTCFullYear(), shiftedDate.getUTCMonth(), shiftedDate.getUTCDate())

    return {
      dayStartMs: utc8DayStartMs - constant.zaiPeak.utcOffsetMinutes * 60_000,
      minuteOfDay: shiftedDate.getUTCHours() * 60 + shiftedDate.getUTCMinutes(),
      weekday: shiftedDate.getUTCDay(),
    }
  }

  protected _resolveWindowRemainingPercent(params: { nowMs: number; peakEndMs: number; peakStartMs: number }): number {
    const { nowMs, peakEndMs, peakStartMs } = params
    const windowMs = peakEndMs - peakStartMs
    const remainingFraction = (peakEndMs - nowMs) / windowMs

    return Math.min(Math.max(remainingFraction, 0), 1) * 100
  }
}
