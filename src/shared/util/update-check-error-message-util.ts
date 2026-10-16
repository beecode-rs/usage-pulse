import { typeUtil } from '@beecode/msh-util'

import { UpdateCheckErrorKind } from '#src/shared/business/enum/update-check-error-kind-enum'
import { type UpdateCheckError } from '#src/shared/business/model/update-model'

export const updateCheckErrorMessageUtil = {
  resolveMessage: (params: { error: UpdateCheckError }): string => {
    const { error } = params

    switch (error.kind) {
      case UpdateCheckErrorKind.HTTP_ERROR: {
        if (error.httpStatusCode === 404) {
          return 'No GitHub release published yet for this project'
        }

        if (error.httpStatusCode === undefined) {
          return 'Update check failed'
        }

        return `Update check failed (HTTP ${String(error.httpStatusCode)})`
      }

      case UpdateCheckErrorKind.INVALID_RESPONSE: {
        return 'Received an invalid response from GitHub'
      }

      case UpdateCheckErrorKind.NETWORK: {
        return 'Network error — check your connection'
      }

      case UpdateCheckErrorKind.RATE_LIMITED: {
        if (error.rateLimitResetAt === undefined) {
          return 'GitHub API rate limit exceeded'
        }

        const resetTimeFormatter = new Intl.DateTimeFormat(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        })

        return `GitHub API rate limit exceeded — resets at ${resetTimeFormatter.format(new Date(error.rateLimitResetAt))}`
      }

      case UpdateCheckErrorKind.TIMEOUT: {
        return 'Request timed out'
      }

      case UpdateCheckErrorKind.UNKNOWN: {
        return 'Update check failed'
      }

      default: {
        throw typeUtil.exhaustiveError('unsupported update check error kind [kind]', error.kind)
      }
    }
  },
}
