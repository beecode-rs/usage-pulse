import { updateCheckErrorService } from '#src/main/business/service/update-check-error-service'
import { type UpdateCheckError } from '#src/shared/business/model/update-model'

export const updateCheckErrorServiceContractHarness = {
  classifyResponse: (params: {
    rateLimitRemaining: string
    rateLimitReset: string
    status: number
  }): UpdateCheckError => {
    const { rateLimitRemaining, rateLimitReset, status } = params

    return updateCheckErrorService.classifyResponse({ rateLimitRemaining, rateLimitReset, status })
  },

  classifyThrown: (params: { simulatedFailure: 'invalid-body' | 'network' | 'timeout' }): UpdateCheckError => {
    const { simulatedFailure } = params

    if (simulatedFailure === 'invalid-body') {
      return updateCheckErrorService.classifyThrown({
        error: updateCheckErrorService.createThrown({
          checkError: updateCheckErrorService.resolveInvalidResponse(),
          message: 'github release response is not an object',
        }),
      })
    }

    const error = new Error('simulated update check failure')

    if (simulatedFailure === 'timeout') {
      error.name = 'TimeoutError'
    }

    return updateCheckErrorService.classifyThrown({ error })
  },
}
