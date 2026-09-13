import { app } from 'electron'
import { join } from 'node:path'

import { type IUsageSnapshotDal } from '#src/main/business/repo/usage-snapshot-repo'
import { FileDal } from '#src/main/dal/file-dal'
import { type ProviderSnapshot } from '#src/shared/business/model/usage-model'

export class UsageSnapshotDal extends FileDal implements IUsageSnapshotDal {
  protected readonly _snapshotFilePath: string

  constructor(params?: { snapshotFilePath?: string }) {
    super()
    const { snapshotFilePath = join(app.getPath('userData'), 'usage-pulse-snapshots.json') } = params ?? {}
    this._snapshotFilePath = snapshotFilePath
  }

  async readSnapshots(): Promise<unknown> {
    return await this._readJsonFile({ filePath: this._snapshotFilePath })
  }

  async writeSnapshots(params: { snapshotsByTrackerId: Record<string, ProviderSnapshot> }): Promise<void> {
    const { snapshotsByTrackerId } = params
    await this._writeJsonFile({ content: snapshotsByTrackerId, filePath: this._snapshotFilePath })
  }
}
