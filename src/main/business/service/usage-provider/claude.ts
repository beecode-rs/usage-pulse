import { type UsageProvider } from '#src/main/business/service/usage-provider/usage-provider'
import { httpUtil } from '#src/main/util/http-util'
import { objectUtil } from '#src/main/util/object-util'
import { percentUtil } from '#src/main/util/percent-util'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import type { UsageWindow } from '#src/shared/business/model/usage-model'
import { constant } from '#src/shared/util/constant'

export class UsageProviderClaude implements UsageProvider {
  protected readonly _usageUrl = 'https://api.anthropic.com/api/oauth/usage'

  getProviderId(): ProviderIdMapper {
    return ProviderIdMapper.CLAUDE
  }

  async fetchUsage(params: { accessToken: string }): Promise<UsageWindow[]> {
    const rawUsage = await httpUtil.fetchJson({
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${params.accessToken}`,
      },
      url: this._usageUrl,
    })
    const usageRecord = this._extractUsageRecord({ raw: rawUsage })

    return this._buildWindows({ usageRecord })
  }

  protected _extractUsageRecord(params: { raw: unknown }): Record<string, unknown> {
    const rootRecord = objectUtil.asRecord(params.raw)

    if (rootRecord === undefined) {
      throw new Error('Claude usage response is not a JSON object')
    }

    return rootRecord
  }

  protected _buildWindows(params: { usageRecord: Record<string, unknown> }): UsageWindow[] {
    const fiveHourWindow = this._buildWindow({
      label: '5-hour window',
      sectionRecord: objectUtil.asRecord(params.usageRecord['five_hour']),
      windowMs: constant.fiveHourWindowMs,
    })

    if (fiveHourWindow === undefined) {
      throw new Error("Claude usage response is missing the 'five_hour' section")
    }

    const windows: UsageWindow[] = [fiveHourWindow]
    const weeklyWindow = this._buildWeeklyWindow({ usageRecord: params.usageRecord })

    if (weeklyWindow !== undefined) {
      windows.push(weeklyWindow)
    }

    return windows
  }

  protected _buildWeeklyWindow(params: { usageRecord: Record<string, unknown> }): UsageWindow | undefined {
    return this._buildWindow({
      label: 'Weekly',
      sectionRecord: objectUtil.asRecord(params.usageRecord['seven_day']),
      windowMs: constant.sevenDayWindowMs,
    })
  }

  protected _buildWindow(params: {
    label: string
    sectionRecord?: Record<string, unknown>
    windowMs?: number
  }): UsageWindow | undefined {
    if (params.sectionRecord === undefined) {
      return undefined
    }

    const percent = this._resolvePercent({ sectionRecord: params.sectionRecord })

    if (percent === undefined) {
      return undefined
    }

    const resetAt = this._resolveResetAt({ sectionRecord: params.sectionRecord })

    if (resetAt === undefined) {
      if (params.windowMs === undefined) {
        return { label: params.label, usedPercent: percent }
      }

      return { label: params.label, usedPercent: percent, windowMs: params.windowMs }
    }

    if (params.windowMs === undefined) {
      return { label: params.label, resetAt, usedPercent: percent }
    }

    return { label: params.label, resetAt, usedPercent: percent, windowMs: params.windowMs }
  }

  protected _resolvePercent(params: { sectionRecord: Record<string, unknown> }): number | undefined {
    const utilization = params.sectionRecord['utilization']

    if (typeof utilization !== 'number' || !Number.isFinite(utilization)) {
      return undefined
    }

    return percentUtil.roundPercentToOneDecimal(percentUtil.clampPercent(utilization))
  }

  protected _resolveResetAt(params: { sectionRecord: Record<string, unknown> }): number | undefined {
    const resetsAt = params.sectionRecord['resets_at']

    if (typeof resetsAt !== 'string' && typeof resetsAt !== 'number') {
      return undefined
    }

    const resetDate = new Date(resetsAt)

    if (Number.isNaN(resetDate.getTime())) {
      return undefined
    }

    return resetDate.getTime()
  }
}
