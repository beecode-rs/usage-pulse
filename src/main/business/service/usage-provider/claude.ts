import { z } from 'zod'

import { type UsageProvider } from '#src/main/business/service/usage-provider/usage-provider'
import { httpUtil } from '#src/main/util/http-util'
import { objectUtil } from '#src/main/util/object-util'
import { percentUtil } from '#src/main/util/percent-util'
import { validationUtil } from '#src/main/util/validation-util'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import type { UsageWindow } from '#src/shared/business/model/usage-model'
import { constant } from '#src/shared/util/constant'

const resetsAtSchema = z
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

const utilizationSchema = z
  .number()
  .transform((value) => {
    return percentUtil.roundPercentToOneDecimal(percentUtil.clampPercent(value))
  })
  .optional()
  .catch(undefined)

const usageSectionSchema = z.object({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- anthropic api field name
  resets_at: resetsAtSchema,
  utilization: utilizationSchema,
})

const usageResponseSchema = z.object({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- anthropic api field name
  five_hour: usageSectionSchema.optional().catch(undefined),
  // eslint-disable-next-line @typescript-eslint/naming-convention -- anthropic api field name
  seven_day: usageSectionSchema.optional().catch(undefined),
})

export class UsageProviderClaude implements UsageProvider {
  protected readonly _usageUrl = 'https://api.anthropic.com/api/oauth/usage'

  getProviderId(): ProviderIdMapper {
    return ProviderIdMapper.CLAUDE
  }

  async fetchUsage(params: { accessToken: string }): Promise<UsageWindow[]> {
    const { accessToken } = params
    const rawUsage = await httpUtil.fetchJson({
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      url: this._usageUrl,
    })
    const usageResponse = this._parseUsageResponse({ raw: rawUsage })

    return this._buildWindows({ usageResponse })
  }

  protected _parseUsageResponse(params: { raw: unknown }): z.infer<typeof usageResponseSchema> {
    const { raw } = params
    const rootRecord = objectUtil.asRecord(raw)

    if (rootRecord === undefined) {
      throw new Error('Claude usage response is not a JSON object')
    }

    return validationUtil.parse(rootRecord, usageResponseSchema)
  }

  protected _buildWindows(params: { usageResponse: z.infer<typeof usageResponseSchema> }): UsageWindow[] {
    const { usageResponse } = params
    const fiveHourWindow = this._buildWindow({
      label: '5-hour window',
      section: usageResponse.five_hour,
      windowMs: constant.fiveHourWindowMs,
    })

    if (fiveHourWindow === undefined) {
      throw new Error("Claude usage response is missing the 'five_hour' section")
    }

    const windows: UsageWindow[] = [fiveHourWindow]
    const weeklyWindow = this._buildWindow({
      label: 'Weekly',
      section: usageResponse.seven_day,
      windowMs: constant.sevenDayWindowMs,
    })

    if (weeklyWindow !== undefined) {
      windows.push(weeklyWindow)
    }

    return windows
  }

  protected _buildWindow(params: {
    label: string
    section?: z.infer<typeof usageSectionSchema>
    windowMs: number
  }): UsageWindow | undefined {
    const { label, section, windowMs } = params

    if (section?.utilization === undefined) {
      return undefined
    }

    if (section.resets_at === undefined) {
      return { label, usedPercent: section.utilization, windowMs }
    }

    return { label, resetAt: section.resets_at, usedPercent: section.utilization, windowMs }
  }
}
