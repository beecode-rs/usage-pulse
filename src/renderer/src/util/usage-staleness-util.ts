import type { TrackerConfig } from '#src/shared/business/model/settings-model'
import type { ProviderSnapshot } from '#src/shared/business/model/usage-model'

export class UsageStalenessUtil {
  isSnapshotStale(params: { nowMs: number; providerSnapshot: ProviderSnapshot; refreshIntervalMs?: number }): boolean {
    const { nowMs, providerSnapshot, refreshIntervalMs } = params

    if (refreshIntervalMs === undefined || providerSnapshot.fetchedAt === undefined) {
      return false
    }

    return nowMs - providerSnapshot.fetchedAt > refreshIntervalMs
  }

  resolveRefreshIntervalMsByTrackerId(params: { trackers: TrackerConfig[] }): Record<string, number> {
    const { trackers } = params

    return Object.fromEntries(
      trackers.map((tracker) => {
        return [tracker.id, tracker.refreshIntervalMs]
      }),
    )
  }
}
