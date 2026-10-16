import { objectUtil } from '#src/main/util/object-util'
import { UpdateCheckErrorKind } from '#src/shared/business/enum/update-check-error-kind-enum'
import { type UpdateCheckError } from '#src/shared/business/model/update-model'

export const updateCheckErrorUtil = {
  classifyResponse: (params: {
    rateLimitRemaining: string
    rateLimitReset: string
    status: number
  }): UpdateCheckError => {
    const { rateLimitRemaining, rateLimitReset, status } = params

    if (status !== 403 || rateLimitRemaining !== '0') {
      return { httpStatusCode: status, kind: UpdateCheckErrorKind.HTTP_ERROR }
    }

    const rateLimitResetAtMs = Number(rateLimitReset) * 1000

    if (!Number.isFinite(rateLimitResetAtMs) || rateLimitResetAtMs <= 0) {
      return { kind: UpdateCheckErrorKind.RATE_LIMITED }
    }

    return { kind: UpdateCheckErrorKind.RATE_LIMITED, rateLimitResetAt: rateLimitResetAtMs }
  },

  classifyThrown: (params: { error: unknown }): UpdateCheckError => {
    const { error } = params
    const errorRecord = objectUtil.asRecord(error)

    if (errorRecord === undefined) {
      return { kind: UpdateCheckErrorKind.NETWORK }
    }

    const attachedCheckError = objectUtil.asRecord(errorRecord['checkError'])

    if (attachedCheckError !== undefined && typeof attachedCheckError['kind'] === 'string') {
      return attachedCheckError as unknown as UpdateCheckError
    }

    if (errorRecord['name'] === 'TimeoutError' || errorRecord['name'] === 'AbortError') {
      return { kind: UpdateCheckErrorKind.TIMEOUT }
    }

    return { kind: UpdateCheckErrorKind.NETWORK }
  },

  createThrown: (params: { checkError: UpdateCheckError; message: string }): Error => {
    const { checkError, message } = params

    return Object.assign(new Error(message), { checkError })
  },

  resolveInvalidResponse: (): UpdateCheckError => {
    return { kind: UpdateCheckErrorKind.INVALID_RESPONSE }
  },
}
