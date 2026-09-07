const NUMERIC_SEGMENT_PATTERN = /^\d+$/

export class VersionCompareUtil {
  isNewerVersion = (params: { candidateVersion: string; currentVersion: string }): boolean => {
    const candidateSegments = this._resolveCoreSegments({ version: params.candidateVersion })
    const currentSegments = this._resolveCoreSegments({ version: params.currentVersion })

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
    const coreVersion = this._resolveCoreVersion({ version: params.version })

    if (coreVersion === '') {
      return undefined
    }

    const segments = coreVersion.split('.')

    const hasMalformedSegment = segments.some((segment) => {
      return !NUMERIC_SEGMENT_PATTERN.test(segment)
    })

    if (hasMalformedSegment) {
      return undefined
    }

    return segments.map((segment) => {
      return Number(segment)
    })
  }

  protected _resolveCoreVersion = (params: { version: string }): string => {
    const strippedVersion = this._stripVersionPrefix({ version: params.version })

    return strippedVersion.split('-')[0] ?? ''
  }

  protected _stripVersionPrefix = (params: { version: string }): string => {
    const trimmedVersion = params.version.trim()

    if (trimmedVersion.startsWith('v') || trimmedVersion.startsWith('V')) {
      return trimmedVersion.slice(1)
    }

    return trimmedVersion
  }
}
