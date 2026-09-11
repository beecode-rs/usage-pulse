import type { SchedulingStrategy } from '#src/main/business/component/scheduling-strategy/scheduling-strategy'
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

export class SchedulingService {
  protected readonly _executablePrefixArgs: string[]
  protected readonly _executablePath: string
  protected readonly _fingerprintsByRegistrationId = new Map<string, string>()
  protected readonly _strategy: SchedulingStrategy

  constructor(params: { executablePrefixArgs?: string[]; executablePath?: string; strategy: SchedulingStrategy }) {
    this._executablePrefixArgs = params.executablePrefixArgs ?? []
    this._executablePath = params.executablePath ?? process.execPath
    this._strategy = params.strategy
  }

  getSchedulingInfo(): SchedulingInfo {
    return {
      isSupported: this._strategy.isSupported,
      platform: this._strategy.getSchedulingPlatform(),
    }
  }

  async inspectRegistrations(params: { settings: AppSettings }): Promise<ScheduleTriggerRegistrationHealth[]> {
    if (!this._strategy.isSupported) {
      return params.settings.triggers.map((trigger) => {
        return { isRegistered: false, triggerId: trigger.id }
      })
    }

    return params.settings.triggers.reduce<Promise<ScheduleTriggerRegistrationHealth[]>>((chain, trigger) => {
      return chain.then(async (inspections) => {
        const inspection = await this._strategy.inspectRegistration({ triggerId: trigger.id })

        return [...inspections, { isRegistered: inspection.isRegistered, triggerId: trigger.id }]
      })
    }, Promise.resolve([]))
  }

  async syncRegistrations(params: { settings: AppSettings }): Promise<void> {
    if (!this._strategy.isSupported) {
      return
    }

    const registeredIds = new Set(await this._strategy.listRegistrationIds())

    if (!params.settings.isSchedulingEnabled) {
      await this._removeRegistrations({ registrationIds: [...registeredIds] })

      return
    }

    const schedulables = this._resolveSchedulables({ settings: params.settings })
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
    const enabledTriggers = params.settings.triggers
      .filter((trigger) => {
        return trigger.isEnabled
      })
      .map((trigger) => {
        return { days: trigger.days, id: trigger.id, times: trigger.times }
      })
    const activeDummyTrackers = params.settings.trackers
      .filter((tracker): tracker is DummyTrackerConfig => {
        return tracker.providerId === ProviderIdMapper.DUMMY && !tracker.isAutoRefreshPaused
      })
      .map((tracker) => {
        return { days: tracker.days, id: tracker.id, times: tracker.times }
      })

    return [...enabledTriggers, ...activeDummyTrackers]
  }

  protected async _removeRegistrations(params: { registrationIds: string[] }): Promise<void> {
    await params.registrationIds.reduce<Promise<void>>((chain, registrationId) => {
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
    await params.schedulables.reduce<Promise<void>>((chain, schedulable) => {
      return chain.then(async () => {
        await this._syncSchedulableRegistration({ registeredIds: params.registeredIds, schedulable })
      })
    }, Promise.resolve())
  }

  protected async _syncSchedulableRegistration(params: {
    registeredIds: Set<string>
    schedulable: SchedulableRegistration
  }): Promise<void> {
    const executableArgs = this._resolveExecutableArgs({ triggerId: params.schedulable.id })
    const fingerprint = this._resolveRegistrationFingerprint({ executableArgs, schedulable: params.schedulable })
    const syncedFingerprint = this._fingerprintsByRegistrationId.get(params.schedulable.id)
    const isRegistrationCurrent = params.registeredIds.has(params.schedulable.id) && syncedFingerprint === fingerprint

    if (isRegistrationCurrent) {
      return
    }

    await this._strategy.upsertRegistration({
      days: params.schedulable.days,
      executableArgs,
      executablePath: this._executablePath,
      times: params.schedulable.times,
      triggerId: params.schedulable.id,
    })
    this._fingerprintsByRegistrationId.set(params.schedulable.id, fingerprint)
  }

  protected _resolveExecutableArgs(params: { triggerId: string }): string[] {
    return [...this._executablePrefixArgs, '--fire-trigger', params.triggerId]
  }

  protected _resolveRegistrationFingerprint(params: {
    executableArgs: string[]
    schedulable: SchedulableRegistration
  }): string {
    return JSON.stringify({
      days: [...params.schedulable.days].sort(),
      executableArgs: params.executableArgs,
      executablePath: this._executablePath,
      times: [...params.schedulable.times].sort(),
    })
  }
}
