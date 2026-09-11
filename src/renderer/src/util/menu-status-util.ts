import { MenuStatusDotMapper } from '#src/renderer/src/business/model/menu-status-dot-mapper-enum'
import { UsagePaceUtil } from '#src/renderer/src/util/usage-pace-util'
import { ZaiPeakUtil } from '#src/renderer/src/util/zai-peak-util'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { UsageStatus } from '#src/shared/business/enum/usage-status-enum'
import type { SessionSnapshot } from '#src/shared/business/model/session-model'
import type { UsageSnapshot } from '#src/shared/business/model/usage-model'
import { constant } from '#src/shared/util/constant'

const MAX_ELAPSED_MINUTES = 300

export class MenuStatusUtil {
  resolveCombinedStatusDot(params: { dots: (MenuStatusDotMapper | undefined)[] }): MenuStatusDotMapper | undefined {
    if (params.dots.includes(MenuStatusDotMapper.ERROR)) {
      return MenuStatusDotMapper.ERROR
    }

    if (params.dots.includes(MenuStatusDotMapper.WARNING)) {
      return MenuStatusDotMapper.WARNING
    }

    if (params.dots.includes(MenuStatusDotMapper.WAITING)) {
      return MenuStatusDotMapper.WAITING
    }

    if (params.dots.includes(MenuStatusDotMapper.PEAK)) {
      return MenuStatusDotMapper.PEAK
    }

    return undefined
  }

  resolveDevelopmentStatusDot(params: {
    elapsedMinutes: number
    now: number
    usedPercent: number
  }): MenuStatusDotMapper | undefined {
    const snapshot: UsageSnapshot = {
      providers: [
        {
          providerId: ProviderIdMapper.ZAI,
          status: UsageStatus.OK,
          trackerId: 'development-zai',
          trackerName: 'z.ai',
          usage: [
            {
              label: '5-hour window',
              resetAt: this._resolveWindowResetAt({
                elapsedMinutes: params.elapsedMinutes,
                now: params.now,
                windowMs: constant.fiveHourWindowMs,
              }),
              usedPercent: params.usedPercent,
              windowMs: constant.fiveHourWindowMs,
            },
            {
              label: 'MCP quota',
              resetAt: this._resolveWindowResetAt({
                elapsedMinutes: params.elapsedMinutes,
                now: params.now,
                windowMs: constant.thirtyDayWindowMs,
              }),
              usedPercent: params.usedPercent,
              windowMs: constant.thirtyDayWindowMs,
            },
          ],
        },
      ],
    }

    return this.resolveUsageStatusDot({ now: params.now, snapshot })
  }

  resolveIsWindowWarning(params: { now: number; resetAt?: number; usedPercent: number; windowMs?: number }): boolean {
    const { resetAt, windowMs } = params

    if (resetAt === undefined || windowMs === undefined) {
      return false
    }

    return new UsagePaceUtil().resolveIsUsageOutpacingWindow({
      now: params.now,
      resetAt,
      usedPercent: params.usedPercent,
      windowMs,
    })
  }

  resolvePeakStatusDot(params: { now: number; snapshot?: UsageSnapshot }): MenuStatusDotMapper | undefined {
    const providers = params.snapshot?.providers ?? []

    const isAnyProviderInPeakHours = providers.some((provider) => {
      const peakInfo = new ZaiPeakUtil().resolvePeakInfo({ nowMs: params.now, providerId: provider.providerId })

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
    const hasSnapshotError = params.snapshot?.errorMessage !== undefined && params.snapshot.errorMessage !== ''

    if (params.hasLoadError === true || hasSnapshotError) {
      return MenuStatusDotMapper.ERROR
    }

    const isAnySessionWaiting = (params.snapshot?.sessions ?? []).some((session) => {
      return session.status === SessionStatusMapper.WAITING
    })

    if (isAnySessionWaiting) {
      return MenuStatusDotMapper.WAITING
    }

    return undefined
  }

  resolveUsageStatusDot(params: { now: number; snapshot?: UsageSnapshot }): MenuStatusDotMapper | undefined {
    const providers = params.snapshot?.providers ?? []

    const isAnyProviderError = providers.some((provider) => {
      return provider.status === UsageStatus.ERROR
    })

    if (isAnyProviderError) {
      return MenuStatusDotMapper.ERROR
    }

    const isAnyWindowWarning = providers.some((provider) => {
      return (provider.usage ?? []).some((window) => {
        return this.resolveIsWindowWarning({
          now: params.now,
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
    const elapsedMs = (params.elapsedMinutes * params.windowMs) / MAX_ELAPSED_MINUTES

    return params.now + params.windowMs - elapsedMs
  }
}
