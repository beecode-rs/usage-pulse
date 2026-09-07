import { z } from 'zod'

import { type UsageProvider } from '#src/main/business/service/usage-provider/usage-provider'
import { httpUtil } from '#src/main/util/http-util'
import { objectUtil } from '#src/main/util/object-util'
import { percentUtil } from '#src/main/util/percent-util'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import type { UsageWindow } from '#src/shared/business/model/usage-model'
import { constant } from '#src/shared/util/constant'

const limitPercentageSchema = z
  .number()
  .transform((value) => {
    return percentUtil.roundPercentToOneDecimal(percentUtil.clampPercent(value))
  })
  .optional()
  .catch(undefined)

const limitNextResetTimeSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined
    }

    const resetDate = new Date(value)

    if (Number.isNaN(resetDate.getTime())) {
      return undefined
    }

    return resetDate.getTime()
  })
  .catch(undefined)

const limitRecordSchema = z.object({
  currentValue: z.number().optional().catch(undefined),
  nextResetTime: limitNextResetTimeSchema,
  number: z.number().optional().catch(undefined),
  percentage: limitPercentageSchema,
  type: z.string().optional().catch(undefined),
  unit: z.number().optional().catch(undefined),
  usage: z.number().optional().catch(undefined),
})

const limitRecordsSchema = z.array(z.unknown()).transform((limits) => {
  return limits.reduce<z.infer<typeof limitRecordSchema>[]>((limitRecords, limit) => {
    const parsedLimit = limitRecordSchema.safeParse(limit)

    if (parsedLimit.success) {
      return [...limitRecords, parsedLimit.data]
    }

    return limitRecords
  }, [])
})

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

  protected _extractLimits(params: { raw: unknown }): z.infer<typeof limitRecordSchema>[] {
    const { raw } = params
    const dataRecord = this._extractDataRecord({ raw })

    if (dataRecord === undefined) {
      throw new Error('z.ai usage response is missing the data object')
    }

    const parsedLimits = limitRecordsSchema.safeParse(dataRecord['limits'])

    if (!parsedLimits.success) {
      throw new Error('z.ai usage response is missing the limits array')
    }

    return parsedLimits.data
  }

  protected _extractDataRecord(params: { raw: unknown }): Record<string, unknown> | undefined {
    const { raw } = params
    const rootRecord = objectUtil.asRecord(raw)

    if (rootRecord === undefined) {
      return undefined
    }

    return objectUtil.asRecord(rootRecord['data'])
  }

  protected _buildWindows(params: { limits: z.infer<typeof limitRecordSchema>[] }): UsageWindow[] {
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

  protected _buildMcpQuotaWindow(params: { limits: z.infer<typeof limitRecordSchema>[] }): UsageWindow | undefined {
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
    limitRecord?: z.infer<typeof limitRecordSchema>
    window?: UsageWindow
  }): UsageWindow | undefined {
    const { limitRecord, window } = params
    if (window === undefined || limitRecord === undefined) {
      return window
    }

    const usedAmount = this._resolveFiniteCount({ value: limitRecord.currentValue })
    const totalAmount = this._resolveFiniteCount({ value: limitRecord.usage })

    if (usedAmount === undefined || totalAmount === undefined || totalAmount <= 0) {
      return window
    }

    return { ...window, totalAmount, usedAmount }
  }

  protected _resolveFiniteCount(params: { value?: number }): number | undefined {
    const { value } = params
    if (value === undefined || value < 0) {
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
    limits: z.infer<typeof limitRecordSchema>[]
    limitType: string
    limitUnit?: number
  }): z.infer<typeof limitRecordSchema> | undefined {
    const { limitNumber, limits, limitType, limitUnit } = params
    const matchingLimit = limits.find((limitRecord) => {
      return (
        limitRecord.type === limitType &&
        this._matchesOptionalLimitField({ actual: limitRecord.unit, expected: limitUnit }) &&
        this._matchesOptionalLimitField({ actual: limitRecord.number, expected: limitNumber })
      )
    })

    return matchingLimit
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
    limitRecord?: z.infer<typeof limitRecordSchema>
    windowMs?: number
  }): UsageWindow | undefined {
    const { expectedLabel, limitRecord, windowMs } = params
    if (limitRecord?.percentage === undefined) {
      return undefined
    }

    if (limitRecord.nextResetTime === undefined) {
      if (windowMs === undefined) {
        return { label: expectedLabel, usedPercent: limitRecord.percentage }
      }

      return { label: expectedLabel, usedPercent: limitRecord.percentage, windowMs }
    }

    if (windowMs === undefined) {
      return {
        label: expectedLabel,
        resetAt: limitRecord.nextResetTime,
        usedPercent: limitRecord.percentage,
      }
    }

    return {
      label: expectedLabel,
      resetAt: limitRecord.nextResetTime,
      usedPercent: limitRecord.percentage,
      windowMs,
    }
  }
}
