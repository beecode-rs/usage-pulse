import { UsageStatus } from '#src/shared/business/enum/usage-status-enum'

export const usageStatusUtil = {
  resolveStatusText: (status: UsageStatus): string => {
    switch (status) {
      case UsageStatus.OK: {
        return 'Live'
      }

      case UsageStatus.ERROR: {
        return 'Error'
      }

      case UsageStatus.PENDING: {
        return 'Loading'
      }

      case UsageStatus.UNCONFIGURED: {
        return 'No token'
      }

      default: {
        throw new Error(`unsupported usage status: ${String(status)}`)
      }
    }
  },
}
