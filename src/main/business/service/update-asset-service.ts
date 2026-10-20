import { constant } from '#src/main/util/constant'
import { type OS } from '#src/shared/business/enum/os-enum'
import { type UpdateAsset } from '#src/shared/business/model/update-model'

export const updateAssetService = {
  resolveUpdateAsset: (params: { assets: UpdateAsset[]; platform: OS }): UpdateAsset | undefined => {
    const { assets, platform } = params

    return constant.update.assetSuffixesByOs[platform]
      .map((suffix) => {
        return assets.find((asset) => {
          return asset.name.toLowerCase().endsWith(suffix.toLowerCase())
        })
      })
      .find((asset) => {
        return asset !== undefined
      })
  },
}
