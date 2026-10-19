import { appSettingsStrictSchema } from '#src/main/business/schema/settings-schema'

export const settingsSchemaContractHarness = {
  parseStrictSettings: (params: { rawSettings: unknown }) => {
    const { rawSettings } = params
    const parsedSettings = appSettingsStrictSchema.safeParse(rawSettings)

    if (parsedSettings.success) {
      return { data: parsedSettings.data, success: true }
    }

    return { success: false }
  },
}
