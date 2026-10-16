import { updateCheckErrorUtil } from '#src/main/util/update-check-error-util'
import { type UpdateCheckError } from '#src/shared/business/model/update-model'

export const updateCheckErrorUtilContractHarness = {
  classifyResponse: (params: {
    rateLimitRemaining: string
    rateLimitReset: string
    status: number
  }): UpdateCheckError => {
    const { rateLimitRemaining, rateLimitReset, status } = params

    return updateCheckErrorUtil.classifyResponse({ rateLimitRemaining, rateLimitReset, status })
  },

  classifyThrown: (params: { simulatedFailure: 'invalid-body' | 'network' | 'timeout' }): UpdateCheckError => {
    const { simulatedFailure } = params

    if (simulatedFailure === 'invalid-body') {
      return updateCheckErrorUtil.classifyThrown({
        error: updateCheckErrorUtil.createThrown({
          checkError: updateCheckErrorUtil.resolveInvalidResponse(),
          message: 'github release response is not an object',
        }),
      })
    }

    const error = new Error('simulated update check failure')

    if (simulatedFailure === 'timeout') {
      error.name = 'TimeoutError'
    }

    return updateCheckErrorUtil.classifyThrown({ error })
  },
}
