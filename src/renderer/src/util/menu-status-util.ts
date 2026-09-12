import { MenuStatusDotMapper } from '#src/renderer/src/business/enum/menu-status-dot-mapper-enum'
import { UsagePaceUtil } from '#src/renderer/src/util/usage-pace-util'
import { ZaiPeakUtil } from '#src/renderer/src/util/zai-peak-util'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { UsageActivityStatus } from '#src/shared/business/enum/usage-activity-status-enum'
import type { SessionSnapshot } from '#src/shared/business/model/session-model'
import type { UsageSnapshot } from '#src/shared/business/model/usage-model'
import { constant } from '#src/shared/util/constant'

const MAX_ELAPSED_MINUTES = 300

export class MenuStatusUtil {
  resolveCombinedStatusDot(params: { dots: (MenuStatusDotMapper | undefined)[] }): MenuStatusDotMapper | undefined {
    const { dots } = params

    if (dots.includes(MenuStatusDotMapper.ERROR)) {
      return MenuStatusDotMapper.ERROR
    }

    if (dots.includes(MenuStatusDotMapper.WARNING)) {
      return MenuStatusDotMapper.WARNING
    }

    if (dots.includes(MenuStatusDotMapper.WAITING)) {
      return MenuStatusDotMapper.WAITING
    }

    if (dots.includes(MenuStatusDotMapper.PEAK)) {
      return MenuStatusDotMapper.PEAK
    }

    return undefined
  }

  resolveDevelopmentStatusDot(params: {
    elapsedMinutes: number
    now: number
    usedPercent: number
  }): MenuStatusDotMapper | undefined {
    const { elapsedMinutes, now, usedPercent } = params

    const snapshot: UsageSnapshot = {
      providers: [
        {
          providerId: ProviderIdMapper.ZAI,
          status: UsageActivityStatus.OK,
          trackerId: 'development-zai',
          trackerName: 'z.ai',
          usage: [
            {
              label: '5-hour window',
              resetAt: this._resolveWindowResetAt({
                elapsedMinutes,
                now,
                windowMs: constant.fiveHourWindowMs,
              }),
              usedPercent,
              windowMs: constant.fiveHourWindowMs,
            },
            {
              label: 'MCP quota',
              resetAt: this._resolveWindowResetAt({
                elapsedMinutes,
                now,
                windowMs: constant.thirtyDayWindowMs,
              }),
              usedPercent,
              windowMs: constant.thirtyDayWindowMs,
            },
          ],
        },
      ],
    }

    return this.resolveUsageActivityStatusDot({ now, snapshot })
  }

  resolveIsWindowWarning(params: { now: number; resetAt?: number; usedPercent: number; windowMs?: number }): boolean {
    const { now, resetAt, usedPercent, windowMs } = params

    if (resetAt === undefined || windowMs === undefined) {
      return false
    }

    return new UsagePaceUtil().resolveIsUsageOutpacingWindow({
      now,
      resetAt,
      usedPercent,
      windowMs,
    })
  }

  resolvePeakStatusDot(params: { now: number; snapshot?: UsageSnapshot }): MenuStatusDotMapper | undefined {
    const { now, snapshot } = params

    const providers = snapshot?.providers ?? []

    const isAnyProviderInPeakHours = providers.some((provider) => {
      const peakInfo = new ZaiPeakUtil().resolvePeakInfo({ nowMs: now, providerId: provider.providerId })

      return peakInfo?.isPeakHour === true
    })

    if (isAnyProviderInPeakHours) {
      return MenuStatusDotMapper.PEAK
    }

    return undefined
  }

  resolveSessionsStatusDot(params: {
    hasLoadError?: boolean
    snapshot?: SessionSnapshot
  }): MenuStatusDotMapper | undefined {
    const { hasLoadError, snapshot } = params

    const hasSnapshotError = snapshot?.errorMessage !== undefined && snapshot.errorMessage !== ''

    if (hasLoadError === true || hasSnapshotError) {
      return MenuStatusDotMapper.ERROR
    }

    const isAnySessionWaiting = (snapshot?.sessions ?? []).some((session) => {
      return session.status === SessionStatusMapper.WAITING
    })

    if (isAnySessionWaiting) {
      return MenuStatusDotMapper.WAITING
    }

    return undefined
  }

  resolveUsageActivityStatusDot(params: { now: number; snapshot?: UsageSnapshot }): MenuStatusDotMapper | undefined {
    const { now, snapshot } = params

    const providers = snapshot?.providers ?? []

    const isAnyProviderError = providers.some((provider) => {
      return provider.status === UsageActivityStatus.ERROR
    })

    if (isAnyProviderError) {
      return MenuStatusDotMapper.ERROR
    }

    const isAnyWindowWarning = providers.some((provider) => {
      return (provider.usage ?? []).some((window) => {
        return this.resolveIsWindowWarning({
          now,
          resetAt: window.resetAt,
          usedPercent: window.usedPercent,
          windowMs: window.windowMs,
        })
      })
    })

    if (isAnyWindowWarning) {
      return MenuStatusDotMapper.WARNING
    }

    return undefined
  }

  protected _resolveWindowResetAt(params: { elapsedMinutes: number; now: number; windowMs: number }): number {
    const { elapsedMinutes, now, windowMs } = params

    const elapsedMs = (elapsedMinutes * windowMs) / MAX_ELAPSED_MINUTES

    return now + windowMs - elapsedMs
  }
}
