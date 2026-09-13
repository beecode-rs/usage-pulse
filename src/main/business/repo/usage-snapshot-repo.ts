import { UsageSnapshotDal } from '#src/main/dal/usage-snapshot-dal'
import { objectUtil } from '#src/main/util/object-util'
import type { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { UsageActivityStatus } from '#src/shared/business/enum/usage-activity-status-enum'
import { type ProviderSnapshot, type UsageWindow } from '#src/shared/business/model/usage-model'
import { constant } from '#src/shared/util/constant'

export interface IUsageSnapshotDal {
  readSnapshots: () => Promise<unknown>
  writeSnapshots: (params: { snapshotsByTrackerId: Record<string, ProviderSnapshot> }) => Promise<void>
}

export class UsageSnapshotRepo {
  protected readonly _dal: IUsageSnapshotDal = new UsageSnapshotDal()

  async load(): Promise<Record<string, ProviderSnapshot>> {
    return this._sanitizeSnapshots({ rawSnapshots: await this._dal.readSnapshots() })
  }

  async save(params: { snapshotsByTrackerId: Record<string, ProviderSnapshot> }): Promise<void> {
    const { snapshotsByTrackerId } = params
    await this._dal.writeSnapshots({ snapshotsByTrackerId })
  }

  protected _sanitizeSnapshots(params: { rawSnapshots: unknown }): Record<string, ProviderSnapshot> {
    const { rawSnapshots } = params
    const rawRecord = objectUtil.asRecord(rawSnapshots)

    if (rawRecord === undefined) {
      return {}
    }

    return Object.values(rawRecord).reduce<Record<string, ProviderSnapshot>>((snapshotsByTrackerId, rawSnapshot) => {
      const snapshot = this._sanitizeSnapshot({ rawSnapshot })

      if (snapshot !== undefined) {
        snapshotsByTrackerId[snapshot.trackerId] = snapshot
      }

      return snapshotsByTrackerId
    }, {})
  }

  protected _sanitizeSnapshot(params: { rawSnapshot: unknown }): ProviderSnapshot | undefined {
    const { rawSnapshot } = params
    const rawRecord = objectUtil.asRecord(rawSnapshot)

    if (rawRecord === undefined) {
      return undefined
    }

    const trackerId = rawRecord['trackerId']

    if (typeof trackerId !== 'string' || trackerId === '') {
      return undefined
    }

    const providerId = this._sanitizeProviderId({ value: rawRecord['providerId'] })

    if (providerId === undefined) {
      return undefined
    }

    const fetchedAt = rawRecord['fetchedAt']

    if (typeof fetchedAt !== 'number' || !Number.isFinite(fetchedAt)) {
      return undefined
    }

    const usage = this._sanitizeUsageWindows({ rawUsage: rawRecord['usage'] })

    if (usage.length === 0) {
      return undefined
    }

    return {
      fetchedAt,
      providerId,
      status: UsageActivityStatus.OK,
      trackerId,
      trackerName: this._sanitizeTrackerName({ providerId, value: rawRecord['trackerName'] }),
      usage,
    }
  }

  protected _sanitizeProviderId(params: { value: unknown }): ProviderIdMapper | undefined {
    const { value } = params
    const catalogEntry = constant.providerCatalog.find((entry) => {
      return entry.id === value
    })

    if (catalogEntry === undefined) {
      return undefined
    }

    return catalogEntry.id
  }

  protected _sanitizeTrackerName(params: { providerId: ProviderIdMapper; value: unknown }): string {
    const { providerId, value } = params
    if (typeof value === 'string' && value !== '') {
      return value
    }

    const catalogEntry = constant.providerCatalog.find((entry) => {
      return entry.id === providerId
    })

    if (catalogEntry === undefined) {
      return providerId
    }

    return catalogEntry.name
  }

  protected _sanitizeUsageWindows(params: { rawUsage: unknown }): UsageWindow[] {
    const { rawUsage } = params
    if (!Array.isArray(rawUsage)) {
      return []
    }

    return rawUsage
      .map((rawWindow) => {
        return this._sanitizeUsageWindow({ rawWindow })
      })
      .filter((usageWindow): usageWindow is UsageWindow => {
        return usageWindow !== undefined
      })
  }

  protected _sanitizeUsageWindow(params: { rawWindow: unknown }): UsageWindow | undefined {
    const { rawWindow } = params
    const rawRecord = objectUtil.asRecord(rawWindow)

    if (rawRecord === undefined) {
      return undefined
    }

    const label = rawRecord['label']

    if (typeof label !== 'string' || label === '') {
      return undefined
    }

    const usedPercent = rawRecord['usedPercent']

    if (typeof usedPercent !== 'number' || !Number.isFinite(usedPercent)) {
      return undefined
    }

    return {
      label,
      resetAt: this._sanitizeOptionalNumber({ value: rawRecord['resetAt'] }),
      totalAmount: this._sanitizeOptionalNumber({ value: rawRecord['totalAmount'] }),
      usedAmount: this._sanitizeOptionalNumber({ value: rawRecord['usedAmount'] }),
      usedPercent,
      windowMs: this._sanitizeOptionalNumber({ value: rawRecord['windowMs'] }),
    }
  }

  protected _sanitizeOptionalNumber(params: { value: unknown }): number | undefined {
    const { value } = params
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return undefined
    }

    return value
  }
}
