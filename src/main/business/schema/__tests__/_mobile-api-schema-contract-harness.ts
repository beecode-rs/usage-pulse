import { mobileWsMessageSchema } from '#src/main/business/schema/mobile-api-schema'

export const mobileApiSchemaContractHarness = {
  parseWsMessage: (params: { message: unknown }) => {
    const { message } = params
    const parsed = mobileWsMessageSchema.safeParse(message)

    if (parsed.success) {
      return { data: parsed.data, success: true }
    }

    return { success: false }
  },
}
