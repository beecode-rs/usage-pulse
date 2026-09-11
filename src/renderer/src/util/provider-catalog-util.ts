import { developmentPrefsUtil } from '#src/renderer/src/util/development-prefs-util'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { type ProviderCatalogEntry } from '#src/shared/business/model/provider-catalog-model'
import { constant } from '#src/shared/util/constant'

const DEV_ONLY_PROVIDER_IDS: ProviderIdMapper[] = [ProviderIdMapper.DUMMY]

export const providerCatalogUtil = {
  resolveVisibleCatalogEntries: (): ProviderCatalogEntry[] => {
    if (developmentPrefsUtil.loadIsUnlocked()) {
      return constant.providerCatalog
    }

    return constant.providerCatalog.filter((catalogEntry) => {
      return !DEV_ONLY_PROVIDER_IDS.includes(catalogEntry.id)
    })
  },
}
