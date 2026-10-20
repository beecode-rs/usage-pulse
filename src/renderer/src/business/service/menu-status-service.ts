import { MenuStatusDotMapper } from '#src/renderer/src/business/enum/menu-status-dot-mapper-enum'
import { UsageStalenessService } from '#src/renderer/src/business/service/usage-staleness-service'
import { ZaiPeakService } from '#src/renderer/src/business/service/zai-peak-service'
import { constant } from '#src/renderer/src/util/constant'
import { UsagePaceUtil } from '#src/renderer/src/util/usage-pace-util'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { UsageActivityStatus } from '#src/shared/business/enum/usage-activity-status-enum'
import type { SessionSnapshot } from '#src/shared/business/model/session-model'
import type { UsageSnapshot } from '#src/shared/business/model/usage-model'
import { constant as sharedConstant } from '#src/shared/util/constant'

export class MenuStatusService {
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
                windowMs: sharedConstant.fiveHourWindowMs,
              }),
              usedPercent,
              windowMs: sharedConstant.fiveHourWindowMs,
            },
            {
              label: 'MCP quota',
              resetAt: this._resolveWindowResetAt({
                elapsedMinutes,
                now,
                windowMs: sharedConstant.thirtyDayWindowMs,
              }),
              usedPercent,
              windowMs: sharedConstant.thirtyDayWindowMs,
            },
          ],
        },
      ],
    }

    return this.resolveUsageActivityStatusDot({ now, snapshot })
  }

  isWindowWarning(params: { now: number; resetAt?: number; usedPercent: number; windowMs?: number }): boolean {
    const { now, resetAt, usedPercent, windowMs } = params

    if (resetAt === undefined || windowMs === undefined) {
      return false
    }

    return new UsagePaceUtil().isUsageOutpacingWindow({
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
      const peakInfo = new ZaiPeakService().resolvePeakInfo({ nowMs: now, providerId: provider.providerId })

      if (peakInfo === undefined) {
        return false
      }

      return peakInfo.isPeakHour
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

    if (hasLoadError || hasSnapshotError) {
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

  resolveStaleStatusDot(params: {
    now: number
    refreshIntervalMsByTrackerId?: Record<string, number>
    snapshot?: UsageSnapshot
  }): MenuStatusDotMapper | undefined {
    const { now, refreshIntervalMsByTrackerId, snapshot } = params
    const stalenessService = new UsageStalenessService()

    const isAnyProviderStale = (snapshot?.providers ?? []).some((provider) => {
      return stalenessService.isSnapshotStale({
        nowMs: now,
        providerSnapshot: provider,
        refreshIntervalMs: refreshIntervalMsByTrackerId?.[provider.trackerId],
      })
    })

    if (isAnyProviderStale) {
      return MenuStatusDotMapper.WARNING
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
        return this.isWindowWarning({
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

    const elapsedMs = (elapsedMinutes * windowMs) / constant.development.elapsedMinutes.max

    return now + windowMs - elapsedMs
  }
}
