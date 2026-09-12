import { singletonPattern } from '@beecode/msh-util'
import { app } from 'electron'

import { SchedulingStrategyFactory } from '#src/main/business/component/scheduling-strategy/factory'
import type { SchedulingStrategy } from '#src/main/business/component/scheduling-strategy/scheduling-strategy'
import { config } from '#src/main/util/config'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import type { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'
import type {
  ScheduleTriggerRegistrationHealth,
  SchedulingInfo,
} from '#src/shared/business/model/schedule-trigger-model'
import type { AppSettings, DummyTrackerConfig } from '#src/shared/business/model/settings-model'

type SchedulableRegistration = {
  days: ScheduleTriggerDayMapper[]
  id: string
  times: string[]
}

export class _SchedulingService {
  protected readonly _executablePrefixArgs: string[]
  protected readonly _executablePath: string
  protected readonly _fingerprintsByRegistrationId = new Map<string, string>()
  protected readonly _strategy: SchedulingStrategy

  constructor(params: { executablePrefixArgs?: string[]; executablePath?: string; strategy: SchedulingStrategy }) {
    const { executablePrefixArgs, executablePath, strategy } = params
    this._executablePrefixArgs = executablePrefixArgs ?? []
    this._executablePath = executablePath ?? process.execPath
    this._strategy = strategy
  }

  getSchedulingInfo(): SchedulingInfo {
    return {
      isSupported: this._strategy.isSupported,
      platform: this._strategy.getSchedulingPlatform(),
    }
  }

  async inspectRegistrations(params: { settings: AppSettings }): Promise<ScheduleTriggerRegistrationHealth[]> {
    const { settings } = params
    if (!this._strategy.isSupported) {
      return settings.triggers.map((trigger) => {
        return { isRegistered: false, triggerId: trigger.id }
      })
    }

    return settings.triggers.reduce<Promise<ScheduleTriggerRegistrationHealth[]>>((chain, trigger) => {
      return chain.then(async (inspections) => {
        const inspection = await this._strategy.inspectRegistration({ triggerId: trigger.id })

        return [...inspections, { isRegistered: inspection.isRegistered, triggerId: trigger.id }]
      })
    }, Promise.resolve([]))
  }

  async syncRegistrations(params: { settings: AppSettings }): Promise<void> {
    const { settings } = params
    if (!this._strategy.isSupported) {
      return
    }

    const registeredIds = new Set(await this._strategy.listRegistrationIds())

    if (!settings.isSchedulingEnabled) {
      await this._removeRegistrations({ registrationIds: [...registeredIds] })

      return
    }

    const schedulables = this._resolveSchedulables({ settings })
    const desiredIds = new Set(
      schedulables.map((schedulable) => {
        return schedulable.id
      }),
    )
    const orphanedIds = [...registeredIds].filter((registeredId) => {
      return !desiredIds.has(registeredId)
    })

    await this._removeRegistrations({ registrationIds: orphanedIds })
    await this._syncSchedulableRegistrations({ registeredIds, schedulables })
  }

  protected _resolveSchedulables(params: { settings: AppSettings }): SchedulableRegistration[] {
    const { settings } = params
    const enabledTriggers = settings.triggers
      .filter((trigger) => {
        return trigger.isEnabled
      })
      .map((trigger) => {
        return { days: trigger.days, id: trigger.id, times: trigger.times }
      })
    const activeDummyTrackers = settings.trackers
      .filter((tracker): tracker is DummyTrackerConfig => {
        return tracker.providerId === ProviderIdMapper.DUMMY && !tracker.isAutoRefreshPaused
      })
      .map((tracker) => {
        return { days: tracker.days, id: tracker.id, times: tracker.times }
      })

    return [...enabledTriggers, ...activeDummyTrackers]
  }

  protected async _removeRegistrations(params: { registrationIds: string[] }): Promise<void> {
    const { registrationIds } = params
    await registrationIds.reduce<Promise<void>>((chain, registrationId) => {
      return chain.then(async () => {
        await this._strategy.removeRegistration({ triggerId: registrationId })
        this._fingerprintsByRegistrationId.delete(registrationId)
      })
    }, Promise.resolve())
  }

  protected async _syncSchedulableRegistrations(params: {
    registeredIds: Set<string>
    schedulables: SchedulableRegistration[]
  }): Promise<void> {
    const { registeredIds, schedulables } = params
    await schedulables.reduce<Promise<void>>((chain, schedulable) => {
      return chain.then(async () => {
        await this._syncSchedulableRegistration({ registeredIds, schedulable })
      })
    }, Promise.resolve())
  }

  protected async _syncSchedulableRegistration(params: {
    registeredIds: Set<string>
    schedulable: SchedulableRegistration
  }): Promise<void> {
    const { registeredIds, schedulable } = params
    const executableArgs = this._resolveExecutableArgs({ triggerId: schedulable.id })
    const fingerprint = this._resolveRegistrationFingerprint({ executableArgs, schedulable })
    const syncedFingerprint = this._fingerprintsByRegistrationId.get(schedulable.id)
    const isRegistrationCurrent = registeredIds.has(schedulable.id) && syncedFingerprint === fingerprint

    if (isRegistrationCurrent) {
      return
    }

    await this._strategy.upsertRegistration({
      days: schedulable.days,
      executableArgs,
      executablePath: this._executablePath,
      times: schedulable.times,
      triggerId: schedulable.id,
    })
    this._fingerprintsByRegistrationId.set(schedulable.id, fingerprint)
  }

  protected _resolveExecutableArgs(params: { triggerId: string }): string[] {
    const { triggerId } = params

    return [...this._executablePrefixArgs, '--fire-trigger', triggerId]
  }

  protected _resolveRegistrationFingerprint(params: {
    executableArgs: string[]
    schedulable: SchedulableRegistration
  }): string {
    const { executableArgs, schedulable } = params

    return JSON.stringify({
      days: [...schedulable.days].sort(),
      executableArgs,
      executablePath: this._executablePath,
      times: [...schedulable.times].sort(),
    })
  }
}

export const schedulingServiceSingleton = singletonPattern(() => {
  const resolveExecutablePrefixArgs = (): string[] => {
    if (app.isPackaged) {
      return ['--no-sandbox']
    }

    return ['--no-sandbox', app.getAppPath()]
  }

  return new _SchedulingService({
    executablePath: config.appImage ?? process.execPath,
    executablePrefixArgs: resolveExecutablePrefixArgs(),
    strategy: new SchedulingStrategyFactory().resolve(),
  })
})
