import { singletonPattern } from '@beecode/msh-util'
import { app } from 'electron'

import { SchedulingStrategyFactory } from '#src/main/business/component/scheduling-strategy/factory'
import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { appEventBusSingleton } from '#src/main/business/service/app-event-bus-singleton'
import { config } from '#src/main/util/config'
import type { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'
import type {
  ScheduleTriggerRegistrationHealth,
  SchedulingInfo,
} from '#src/shared/business/model/schedule-trigger-model'
import type { SettingsModel } from '#src/shared/business/model/settings-model'

type SchedulableRegistration = {
  days: ScheduleTriggerDayMapper[]
  id: string
  times: string[]
}

export class _SchedulingService {
  protected readonly _executablePrefixArgs = this._resolveDefaultExecutablePrefixArgs()
  protected readonly _executablePath = config.appImage ?? process.execPath
  protected readonly _fingerprintsByRegistrationId = new Map<string, string>()
  protected readonly _settingsRepo = settingsRepoSingleton()
  protected readonly _settingsSavedSubscription = appEventBusSingleton().subscribe({
    listener: () => {
      void this.syncRegistrations().catch(() => {
        return undefined
      })
    },
    type: AppEventType.SETTINGS_SAVED,
  })

  protected readonly _strategy = new SchedulingStrategyFactory().resolve()

  getSchedulingInfo(): SchedulingInfo {
    return {
      isSupported: this._strategy.isSupported,
      platform: this._strategy.getSchedulingPlatform(),
    }
  }

  async inspectRegistrations(): Promise<ScheduleTriggerRegistrationHealth[]> {
    const settings = this._settingsRepo.fetch()
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

  async syncRegistrations(): Promise<void> {
    const settings = this._settingsRepo.fetch()
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

  protected _resolveDefaultExecutablePrefixArgs(): string[] {
    if (app.isPackaged) {
      return ['--no-sandbox']
    }

    return ['--no-sandbox', app.getAppPath()]
  }

  protected _resolveSchedulables(params: { settings: SettingsModel }): SchedulableRegistration[] {
    const { settings } = params

    return settings.triggers
      .filter((trigger) => {
        return trigger.isEnabled
      })
      .map((trigger) => {
        return { days: trigger.days, id: trigger.id, times: trigger.times }
      })
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
  return new _SchedulingService()
})
