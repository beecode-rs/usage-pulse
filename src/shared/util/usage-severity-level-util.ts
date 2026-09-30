import { UsageSeverityLevel } from '#src/shared/business/enum/usage-severity-level-enum'
import { constant } from '#src/shared/util/constant'

export const usageSeverityLevelUtil = {
  resolveSeverityLevel(params: { usedPercent: number }): UsageSeverityLevel {
    const { usedPercent } = params
    if (usedPercent < constant.usageSeverityThresholds.fillingUpPercent) {
      return UsageSeverityLevel.NONE
    }

    if (usedPercent < constant.usageSeverityThresholds.highUsagePercent) {
      return UsageSeverityLevel.FILLING_UP
    }

    if (usedPercent < constant.usageSeverityThresholds.limitReachedPercent) {
      return UsageSeverityLevel.HIGH_USAGE
    }

    return UsageSeverityLevel.LIMIT_REACHED
  },
}
