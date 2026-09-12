import { type UsageProvider } from '#src/main/business/service/usage-provider/usage-provider'
import { httpUtil } from '#src/main/util/http-util'
import { objectUtil } from '#src/main/util/object-util'
import { percentUtil } from '#src/main/util/percent-util'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import type { UsageWindow } from '#src/shared/business/model/usage-model'
import { constant } from '#src/shared/util/constant'

export class UsageProviderZai implements UsageProvider {
  protected readonly _quotaLimitUrl = 'https://api.z.ai/api/monitor/usage/quota/limit'

  getProviderId(): ProviderIdMapper {
    return ProviderIdMapper.ZAI
  }

  async fetchUsage(params: { accessToken: string }): Promise<UsageWindow[]> {
    const { accessToken } = params
    const headers = Object.fromEntries([
      ['Accept-Language', 'en-US,en'],
      ['Authorization', accessToken],
      ['Content-Type', 'application/json'],
    ])
    const rawQuota = await httpUtil.fetchJson({ headers, url: this._quotaLimitUrl })
    const limits = this._extractLimits({ raw: rawQuota })

    return this._buildWindows({ limits })
  }

  protected _extractLimits(params: { raw: unknown }): unknown[] {
    const { raw } = params
    const dataRecord = this._extractDataRecord({ raw })

    if (dataRecord === undefined) {
      throw new Error('z.ai usage response is missing the data object')
    }

    const limits = dataRecord['limits']

    if (!Array.isArray(limits)) {
      throw new Error('z.ai usage response is missing the limits array')
    }

    return limits
  }

  protected _extractDataRecord(params: { raw: unknown }): Record<string, unknown> | undefined {
    const { raw } = params
    const rootRecord = objectUtil.asRecord(raw)

    if (rootRecord === undefined) {
      return undefined
    }

    return objectUtil.asRecord(rootRecord['data'])
  }

  protected _buildWindows(params: { limits: unknown[] }): UsageWindow[] {
    const { limits } = params
    const windows = [
      this._buildWindow({
        expectedLabel: '5-hour window',
        limitRecord: this._findLimitRecord({
          limitNumber: 5,
          limits,
          limitType: 'TOKENS_LIMIT',
          limitUnit: 3,
        }),
        windowMs: constant.fiveHourWindowMs,
      }),
      this._buildMcpQuotaWindow({ limits }),
    ].filter((window) => {
      return window !== undefined
    })

    if (windows.length === 0) {
      throw new Error('z.ai usage response contains no recognizable quota limits')
    }

    return windows
  }

  protected _buildMcpQuotaWindow(params: { limits: unknown[] }): UsageWindow | undefined {
    const { limits } = params
    const limitRecord = this._findLimitRecord({ limits, limitType: 'TIME_LIMIT' })

    return this._stampMcpAmounts({
      limitRecord,
      window: this._stampCalendarMonthWindowMs({
        window: this._buildWindow({ expectedLabel: 'MCP quota', limitRecord }),
      }),
    })
  }

  protected _stampMcpAmounts(params: {
    limitRecord?: Record<string, unknown>
    window?: UsageWindow
  }): UsageWindow | undefined {
    const { limitRecord, window } = params
    if (window === undefined || limitRecord === undefined) {
      return window
    }

    const usedAmount = this._resolveFiniteCount({ value: limitRecord['currentValue'] })
    const totalAmount = this._resolveFiniteCount({ value: limitRecord['usage'] })

    if (usedAmount === undefined || totalAmount === undefined || totalAmount <= 0) {
      return window
    }

    return { ...window, totalAmount, usedAmount }
  }

  protected _resolveFiniteCount(params: { value: unknown }): number | undefined {
    const { value } = params
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return undefined
    }

    return Math.round(value)
  }

  protected _stampCalendarMonthWindowMs(params: { window?: UsageWindow }): UsageWindow | undefined {
    const { window } = params
    if (window?.resetAt === undefined) {
      return window
    }

    const windowStartDate = new Date(window.resetAt)

    windowStartDate.setMonth(windowStartDate.getMonth() - 1)

    return { ...window, windowMs: window.resetAt - windowStartDate.getTime() }
  }

  protected _findLimitRecord(params: {
    limitNumber?: number
    limits: unknown[]
    limitType: string
    limitUnit?: number
  }): Record<string, unknown> | undefined {
    const { limitNumber, limits, limitType, limitUnit } = params
    const matchingLimit = limits.find((limit) => {
      const limitRecord = objectUtil.asRecord(limit)

      if (limitRecord === undefined) {
        return false
      }

      return (
        limitRecord['type'] === limitType &&
        this._matchesOptionalLimitField({ actual: limitRecord['unit'], expected: limitUnit }) &&
        this._matchesOptionalLimitField({ actual: limitRecord['number'], expected: limitNumber })
      )
    })

    return objectUtil.asRecord(matchingLimit)
  }

  protected _matchesOptionalLimitField(params: { actual: unknown; expected?: number }): boolean {
    const { actual, expected } = params
    if (expected === undefined) {
      return true
    }

    return actual === expected
  }

  protected _buildWindow(params: {
    expectedLabel: string
    limitRecord?: Record<string, unknown>
    windowMs?: number
  }): UsageWindow | undefined {
    const { expectedLabel, limitRecord, windowMs } = params
    if (limitRecord === undefined) {
      return undefined
    }

    const percent = this._resolvePercent({ limitRecord })

    if (percent === undefined) {
      return undefined
    }

    const resetAt = this._resolveResetAt({ limitRecord })

    if (resetAt === undefined) {
      if (windowMs === undefined) {
        return { label: expectedLabel, usedPercent: percent }
      }

      return { label: expectedLabel, usedPercent: percent, windowMs }
    }

    if (windowMs === undefined) {
      return { label: expectedLabel, resetAt, usedPercent: percent }
    }

    return { label: expectedLabel, resetAt, usedPercent: percent, windowMs }
  }

  protected _resolvePercent(params: { limitRecord: Record<string, unknown> }): number | undefined {
    const { limitRecord } = params
    const percent = limitRecord['percentage']

    if (typeof percent !== 'number' || !Number.isFinite(percent)) {
      return undefined
    }

    return percentUtil.roundPercentToOneDecimal(percentUtil.clampPercent(percent))
  }

  protected _resolveResetAt(params: { limitRecord: Record<string, unknown> }): number | undefined {
    const { limitRecord } = params
    const nextResetTime = limitRecord['nextResetTime']

    if (typeof nextResetTime !== 'string' && typeof nextResetTime !== 'number') {
      return undefined
    }

    const resetDate = new Date(nextResetTime)

    if (Number.isNaN(resetDate.getTime())) {
      return undefined
    }

    return resetDate.getTime()
  }
}
