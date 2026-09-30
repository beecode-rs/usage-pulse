import { typeUtil } from '@beecode/msh-util'

import { UsageSeverityLevel } from '#src/shared/business/enum/usage-severity-level-enum'
import { usageSeverityLevelUtil } from '#src/shared/util/usage-severity-level-util'

export const usageSeverityUtil = {
  resolveSeverityColorVar: (percent: number): string => {
    if (percent < 70) {
      return 'var(--meter-accent)'
    }

    if (percent < 85) {
      return 'var(--meter-warning)'
    }

    if (percent < 95) {
      return 'var(--meter-serious)'
    }

    return 'var(--meter-critical)'
  },

  resolveSeverityLabel: (percent: number): string => {
    const severityLevel = usageSeverityLevelUtil.resolveSeverityLevel({ usedPercent: percent })

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
