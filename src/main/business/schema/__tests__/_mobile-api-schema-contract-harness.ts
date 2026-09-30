import {
  mobileHealthResponseSchema,
  mobileStateResponseSchema,
  mobileWsMessageSchema,
} from '#src/main/business/schema/mobile-api-schema'

export const mobileApiSchemaContractHarness = {
  parseHealthResponse: (params: { response: unknown }) => {
    const { response } = params
    const parsed = mobileHealthResponseSchema.safeParse(response)

    if (parsed.success) {
      return { data: parsed.data, success: true }
    }

    return { success: false }
  },
  parseStateResponse: (params: { response: unknown }) => {
    const { response } = params
    const parsed = mobileStateResponseSchema.safeParse(response)

    if (parsed.success) {
      return { data: parsed.data, success: true }
    }

    return { success: false }
  },
  parseWsMessage: (params: { message: unknown }) => {
    const { message } = params
    const parsed = mobileWsMessageSchema.safeParse(message)

    if (parsed.success) {
      return { data: parsed.data, success: true }
    }

    return { success: false }
  },
}
