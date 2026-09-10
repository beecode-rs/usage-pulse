import { UsagePaceUtil } from '#src/renderer/src/util/usage-pace-util'
import { ZaiPeakUtil } from '#src/renderer/src/util/zai-peak-util'
import type { ISessionSnapshot } from '#src/shared/session-model'
import { FIVE_HOUR_WINDOW_MS, type IUsageSnapshot, UsageStatus } from '#src/shared/usage-model'

const MAX_ELAPSED_MINUTES = 300

export const MONTH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export type MenuStatusDot = 'error' | 'peak' | 'waiting' | 'warning'

export class MenuStatusUtil {
  resolveCombinedStatusDot(params: { dots: (MenuStatusDot | undefined)[] }): MenuStatusDot | undefined {
    if (params.dots.includes('error')) {
      return 'error'
    }

    if (params.dots.includes('warning')) {
      return 'warning'
    }

    if (params.dots.includes('waiting')) {
      return 'waiting'
    }

    if (params.dots.includes('peak')) {
      return 'peak'
    }

    return undefined
  }

  resolveDevelopmentStatusDot(params: {
    elapsedMinutes: number
    now: number
    usedPercent: number
  }): MenuStatusDot | undefined {
    const snapshot: IUsageSnapshot = {
      providers: [
        {
          providerId: 'zai',
          status: UsageStatus.OK,
          trackerId: 'development-zai',
          trackerName: 'z.ai',
          usage: [
            {
              label: '5-hour window',
              resetAt: this._resolveWindowResetAt({
                elapsedMinutes: params.elapsedMinutes,
                now: params.now,
                windowMs: FIVE_HOUR_WINDOW_MS,
              }),
              usedPercent: params.usedPercent,
              windowMs: FIVE_HOUR_WINDOW_MS,
            },
            {
              label: 'MCP quota',
              resetAt: this._resolveWindowResetAt({
                elapsedMinutes: params.elapsedMinutes,
                now: params.now,
                windowMs: MONTH_WINDOW_MS,
              }),
              usedPercent: params.usedPercent,
              windowMs: MONTH_WINDOW_MS,
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

  resolvePeakStatusDot(params: { now: number; snapshot?: IUsageSnapshot }): MenuStatusDot | undefined {
    const providers = params.snapshot?.providers ?? []

    const isAnyProviderInPeakHours = providers.some((provider) => {
      const peakInfo = new ZaiPeakUtil().resolvePeakInfo({ nowMs: params.now, providerId: provider.providerId })

      return peakInfo?.isPeakHour === true
    })

    if (isAnyProviderInPeakHours) {
      return 'peak'
    }

    return undefined
  }

  resolveSessionsStatusDot(params: { hasLoadError?: boolean; snapshot?: ISessionSnapshot }): MenuStatusDot | undefined {
    const hasSnapshotError = params.snapshot?.errorMessage !== undefined && params.snapshot.errorMessage !== ''

    if (params.hasLoadError === true || hasSnapshotError) {
      return 'error'
    }

    const isAnySessionWaiting = (params.snapshot?.sessions ?? []).some((session) => {
      return session.status === 'waiting'
    })

    if (isAnySessionWaiting) {
      return 'waiting'
    }

    return undefined
  }

  resolveUsageStatusDot(params: { now: number; snapshot?: IUsageSnapshot }): MenuStatusDot | undefined {
    const providers = params.snapshot?.providers ?? []

    const isAnyProviderError = providers.some((provider) => {
      return provider.status === UsageStatus.ERROR
    })

    if (isAnyProviderError) {
      return 'error'
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
      return 'warning'
    }

    return undefined
  }

  protected _resolveWindowResetAt(params: { elapsedMinutes: number; now: number; windowMs: number }): number {
    const elapsedMs = (params.elapsedMinutes * params.windowMs) / MAX_ELAPSED_MINUTES

    return params.now + params.windowMs - elapsedMs
  }
}
