import { OS } from '#src/shared/business/enum/os-enum'

export const constant = {
  appBundleRegex: /^(?:-)?(.*?\/[^/]+\.app)\//,
  digitsOnlyRegex: /^\d+$/,
  processLineRegex: /^\s*(\d+)\s+(.+)$/,
  sessionTranscriptCacheEntryLimit: 500,
  twoDigitTimeRegex: /^([0-9]{2}):([0-9]{2})$/,
  updateAssetSuffixesByOs: {
    [OS.LINUX]: ['.AppImage', '.deb'],
    [OS.MACOS]: ['.dmg'],
    [OS.WINDOWS]: ['.exe'],
  },
  updateDownloadPartialFileSuffix: '.part',
}
