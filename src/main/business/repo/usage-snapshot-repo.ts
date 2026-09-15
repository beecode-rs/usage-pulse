import { z } from 'zod'

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

const providerCatalogIds = constant.providerCatalog.map((entry) => {
  return entry.id
})

const usageWindowSchema = z.object({
  label: z.string().min(1),
  resetAt: z.number().optional().catch(undefined),
  totalAmount: z.number().optional().catch(undefined),
  usedAmount: z.number().optional().catch(undefined),
  usedPercent: z.number(),
  windowMs: z.number().optional().catch(undefined),
})

const usageWindowsSchema = z.array(z.unknown()).transform((rawUsage) => {
  return rawUsage.reduce<UsageWindow[]>((usageWindows, rawWindow) => {
    const parsedWindow = usageWindowSchema.safeParse(rawWindow)

    if (parsedWindow.success) {
      return [...usageWindows, parsedWindow.data]
    }

    return usageWindows
  }, [])
})

const providerSnapshotEntrySchema = z
  .object({
    fetchedAt: z.number(),
    providerId: z.enum(providerCatalogIds),
    trackerId: z.string().min(1),
    trackerName: z.unknown().optional(),
    usage: usageWindowsSchema,
  })
  .refine((snapshot) => {
    return snapshot.usage.length > 0
  })

export class UsageSnapshotRepo {
  protected readonly _dal: IUsageSnapshotDal

  constructor(params?: { snapshotFilePath?: string }) {
    const { snapshotFilePath } = params ?? {}
    this._dal = new UsageSnapshotDal({ snapshotFilePath })
  }

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
      const parsedSnapshot = providerSnapshotEntrySchema.safeParse(rawSnapshot)

      if (parsedSnapshot.success) {
        snapshotsByTrackerId[parsedSnapshot.data.trackerId] = this._toProviderSnapshot({
          snapshot: parsedSnapshot.data,
        })
      }

      return snapshotsByTrackerId
    }, {})
  }

  protected _toProviderSnapshot(params: { snapshot: z.infer<typeof providerSnapshotEntrySchema> }): ProviderSnapshot {
    const { snapshot } = params
    const { fetchedAt, providerId, trackerId, usage } = snapshot

    return {
      fetchedAt,
      providerId,
      status: UsageActivityStatus.OK,
      trackerId,
      trackerName: this._resolveTrackerName({ providerId, value: snapshot.trackerName }),
      usage,
    }
  }

  protected _resolveTrackerName(params: { providerId: ProviderIdMapper; value: unknown }): string {
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
}
