import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { type IUsageSnapshotDal, UsageSnapshotRepo } from '#src/main/business/repo/usage-snapshot-repo'
import { UsageSnapshotDal } from '#src/main/dal/usage-snapshot-dal'
import { type ProviderSnapshot } from '#src/shared/business/model/usage-model'

class TempFileUsageSnapshotRepo extends UsageSnapshotRepo {
  declare protected readonly _dal: IUsageSnapshotDal

  constructor(params: { snapshotFilePath: string }) {
    super()
    const { snapshotFilePath } = params
    this._dal = new UsageSnapshotDal({ snapshotFilePath })
  }
}

const resolveTempSnapshotFilePath = (): string => {
  return join(mkdtempSync(join(tmpdir(), 'usage-snapshot-repo-')), 'usage-pulse-snapshots.json')
}

export const usageSnapshotRepoContractHarness = {
  loadAfterSave: async (params: {
    snapshotsByTrackerId: Record<string, ProviderSnapshot>
  }): Promise<Record<string, ProviderSnapshot>> => {
    const { snapshotsByTrackerId } = params
    const repo = new TempFileUsageSnapshotRepo({ snapshotFilePath: resolveTempSnapshotFilePath() })
    await repo.save({ snapshotsByTrackerId })

    return await repo.load()
  },
  loadOnMalformedFile: async (): Promise<Record<string, ProviderSnapshot>> => {
    const snapshotFilePath = resolveTempSnapshotFilePath()
    writeFileSync(snapshotFilePath, '{"tracker-claude-main": {"fetchedAt": not-json', 'utf8')

    return await new TempFileUsageSnapshotRepo({ snapshotFilePath }).load()
  },
  loadOnMissingFile: async (): Promise<Record<string, ProviderSnapshot>> => {
    return await new TempFileUsageSnapshotRepo({ snapshotFilePath: resolveTempSnapshotFilePath() }).load()
  },
  loadOnRawSnapshots: async (params: { rawSnapshots: unknown }): Promise<Record<string, ProviderSnapshot>> => {
    const { rawSnapshots } = params
    const snapshotFilePath = resolveTempSnapshotFilePath()
    writeFileSync(snapshotFilePath, JSON.stringify(rawSnapshots), 'utf8')

    return await new TempFileUsageSnapshotRepo({ snapshotFilePath }).load()
  },
}
