import { singletonPattern } from '@beecode/msh-util'

import { TriggerRunLogDal } from '#src/main/dal/trigger-run-log-dal'
import { type ScheduleTriggerRunLogEntry } from '#src/shared/business/model/schedule-trigger-model'
import { constant } from '#src/shared/util/constant'

export interface ITriggerRunLogDal {
  appendLogEntry: (params: { entry: ScheduleTriggerRunLogEntry }) => Promise<void>
  readLogEntries: () => Promise<ScheduleTriggerRunLogEntry[]>
  writeLogEntries: (params: { entries: ScheduleTriggerRunLogEntry[] }) => Promise<void>
}

export class _TriggerRunLogRepo {
  protected readonly _dal: ITriggerRunLogDal = new TriggerRunLogDal()
  protected readonly _readEntryLimit = constant.scheduleTrigger.run.log.readEntryLimit

  async append(params: { entry: ScheduleTriggerRunLogEntry }): Promise<void> {
    const { entry } = params
    await this._dal.appendLogEntry({ entry })
  }

  async listByTriggerId(params: { triggerId: string }): Promise<ScheduleTriggerRunLogEntry[]> {
    const { triggerId } = params
    const entries = await this._dal.readLogEntries()

    return entries
      .filter((entry) => {
        return entry.triggerId === triggerId
      })
      .slice(-this._readEntryLimit)
  }

  async removeByTriggerId(params: { triggerId: string }): Promise<void> {
    const { triggerId } = params
    const entries = await this._dal.readLogEntries()
    const keptEntries = entries.filter((entry) => {
      return entry.triggerId !== triggerId
    })

    await this._dal.writeLogEntries({ entries: keptEntries })
  }
}

export const triggerRunLogRepoSingleton = singletonPattern(() => {
  return new _TriggerRunLogRepo()
})
