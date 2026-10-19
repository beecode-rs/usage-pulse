import { typeUtil } from '@beecode/msh-util'

import { UsageSeverityLevel } from '#src/shared/business/enum/usage-severity-level-enum'
import { usageSeverityLevelService } from '#src/shared/business/service/usage-severity-level-service'
import { constant } from '#src/shared/util/constant'

export const usageSeverityService = {
  resolveSeverityColorVar: (percent: number): string => {
    if (percent < constant.usageSeverityThresholds.fillingUpPercent) {
      return 'var(--meter-accent)'
    }

    if (percent < constant.usageSeverityThresholds.highUsagePercent) {
      return 'var(--meter-warning)'
    }

    if (percent < constant.usageSeverityThresholds.limitReachedPercent) {
      return 'var(--meter-serious)'
    }

    return 'var(--meter-critical)'
  },

  resolveSeverityLabel: (percent: number): string => {
    const severityLevel = usageSeverityLevelService.resolveSeverityLevel({ usedPercent: percent })

    switch (severityLevel) {
      case UsageSeverityLevel.FILLING_UP: {
        return 'Filling up'
      }

      case UsageSeverityLevel.HIGH_USAGE: {
        return 'High usage'
      }

      case UsageSeverityLevel.LIMIT_REACHED: {
        return 'Limit reached'
      }

      case UsageSeverityLevel.NONE: {
        return ''
      }

      default: {
        throw typeUtil.exhaustiveError('unsupported usage severity level [severityLevel]', severityLevel)
      }
    }
  },
}
