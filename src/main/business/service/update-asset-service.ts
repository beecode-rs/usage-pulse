import { typeUtil } from '@beecode/msh-util'

import { constant } from '#src/main/util/constant'
import { OS } from '#src/shared/business/enum/os-enum'
import {
  type UpdateAsset,
  type UpdateDebInstallOutcome,
  type UpdateInstallType,
} from '#src/shared/business/model/update-model'

export const updateAssetService = {
  resolveDebInstallOutcome: (params: { exitCode: number | null; isSpawnFailed: boolean }): UpdateDebInstallOutcome => {
    const { exitCode, isSpawnFailed } = params

    if (isSpawnFailed) {
      return 'fallback'
    }

    if (exitCode === 0) {
      return 'installed'
    }

    if (
      exitCode === constant.update.debInstallCancelledExitCode ||
      exitCode === constant.update.debInstallUnauthorizedExitCode
    ) {
      return 'fallback'
    }

    return 'failed'
  },

  resolveInstallType: (params: {
    appImagePath: string | null
    isPackaged: boolean
    platform: OS
  }): UpdateInstallType => {
    const { appImagePath, isPackaged, platform } = params

    switch (platform) {
      case OS.LINUX: {
        if (!isPackaged) {
          return 'dev'
        }

        if (appImagePath !== null) {
          return 'appImage'
        }

        return 'deb'
      }

      case OS.MACOS: {
        return 'dmg'
      }

      case OS.WINDOWS: {
        return 'exe'
      }

      default: {
        throw typeUtil.exhaustiveError('unsupported platform', platform)
      }
    }
  },

  resolveUpdateAsset: (params: { assets: UpdateAsset[]; installType: UpdateInstallType }): UpdateAsset | undefined => {
    const { assets, installType } = params

    return constant.update.assetSuffixesByInstallType[installType]
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
