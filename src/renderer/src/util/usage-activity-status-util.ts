import { typeUtil } from '@beecode/msh-util'

import { UsageActivityStatus } from '#src/shared/business/enum/usage-activity-status-enum'

export const usageActivityStatusUtil = {
  resolveStatusText: (status: UsageActivityStatus): string => {
    switch (status) {
      case UsageActivityStatus.OK: {
        return 'Live'
      }

      case UsageActivityStatus.ERROR: {
        return 'Error'
      }

      case UsageActivityStatus.PENDING: {
        return 'Loading'
      }

      case UsageActivityStatus.UNCONFIGURED: {
        return 'No token'
      }

      default: {
        throw typeUtil.exhaustiveError('unsupported usage activity status [status]', status)
      }
    }
  },
}
