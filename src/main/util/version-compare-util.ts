import { constant } from '#src/main/util/constant'

export class VersionCompareUtil {
  isNewerVersion = (params: { candidateVersion: string; currentVersion: string }): boolean => {
    const { candidateVersion, currentVersion } = params
    const candidateSegments = this._resolveCoreSegments({ version: candidateVersion })
    const currentSegments = this._resolveCoreSegments({ version: currentVersion })

    if (candidateSegments === undefined || currentSegments === undefined) {
      return false
    }

    const segmentCount = Math.max(candidateSegments.length, currentSegments.length)
    const firstNonZeroDifference = Array.from({ length: segmentCount }, (_unused, index) => {
      return (candidateSegments[index] ?? 0) - (currentSegments[index] ?? 0)
    }).find((difference) => {
      return difference !== 0
    })

    if (firstNonZeroDifference === undefined) {
      return false
    }

    return firstNonZeroDifference > 0
  }

  protected _resolveCoreSegments = (params: { version: string }): number[] | undefined => {
    const { version } = params
    const coreVersion = this._resolveCoreVersion({ version })

    if (coreVersion === '') {
      return undefined
    }

    const segments = coreVersion.split('.')

    const hasMalformedSegment = segments.some((segment) => {
      return !constant.digitsOnlyRegex.test(segment)
    })

    if (hasMalformedSegment) {
      return undefined
    }

    return segments.map((segment) => {
      return Number(segment)
    })
  }

  protected _resolveCoreVersion = (params: { version: string }): string => {
    const { version } = params
    const strippedVersion = this._stripVersionPrefix({ version })

    return strippedVersion.split('-')[0] ?? ''
  }

  protected _stripVersionPrefix = (params: { version: string }): string => {
    const { version } = params
    const trimmedVersion = version.trim()

    if (trimmedVersion.startsWith('v') || trimmedVersion.startsWith('V')) {
      return trimmedVersion.slice(1)
    }

    return trimmedVersion
  }
}
