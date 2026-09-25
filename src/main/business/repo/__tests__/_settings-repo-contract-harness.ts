import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import {
  type ISettingsDal,
  _SettingsRepo,
  settingsRepoSingleton,
} from '#src/main/business/repo/settings-repo-singleton'
import { appEventBusSingleton } from '#src/main/business/service/app-event-bus-singleton'
import { SettingsDal } from '#src/main/dal/settings-dal'
import { type SettingsModel } from '#src/shared/business/model/settings-model'

const deterministicNowMs = 1_700_000_000_000

let generatedIdCount = 0

const nextGeneratedId = (): string => {
  generatedIdCount += 1

  return `generated-id-${String(generatedIdCount)}`
}

const resolveDeterministicNow = (): number => {
  return deterministicNowMs
}

class TempFileSettingsRepo extends _SettingsRepo {
  declare protected readonly _dal: ISettingsDal

  constructor(params: { settingsFilePath: string }) {
    super()
    const { settingsFilePath } = params
    this._dal = new SettingsDal({ settingsFilePath })
  }

  override sanitize(params: { rawSettings: unknown }): SettingsModel {
    const originalRandomUuid = crypto.randomUUID.bind(crypto)
    const originalNow = Date.now
    generatedIdCount = 0
    crypto.randomUUID = nextGeneratedId as typeof crypto.randomUUID
    Date.now = resolveDeterministicNow

    try {
      return super.sanitize(params)
    } finally {
      crypto.randomUUID = originalRandomUuid
      Date.now = originalNow
    }
  }
}

const resolveTempSettingsFilePath = (): string => {
  return join(mkdtempSync(join(tmpdir(), 'settings-repo-')), 'settings.json')
}

const createTempFileSettingsRepo = (): TempFileSettingsRepo => {
  return new TempFileSettingsRepo({ settingsFilePath: resolveTempSettingsFilePath() })
}

export const settingsRepoContractHarness = {
  fetchAfterInitOnMissingFile: async (): Promise<SettingsModel> => {
    const repo = createTempFileSettingsRepo()
    await repo.init()

    return repo.fetch()
  },
  fetchAfterInitOnRawFileSettings: async (params: { rawSettings: unknown }): Promise<SettingsModel> => {
    const { rawSettings } = params
    const settingsFilePath = resolveTempSettingsFilePath()
    writeFileSync(settingsFilePath, JSON.stringify(rawSettings), 'utf8')
    const repo = new TempFileSettingsRepo({ settingsFilePath })
    await repo.init()

    return repo.fetch()
  },
  fetchAfterSave: async (params: { settings: SettingsModel }): Promise<SettingsModel> => {
    const { settings } = params
    const repo = createTempFileSettingsRepo()
    await repo.save({ settings })

    return repo.fetch()
  },
  fetchErrorMessageBeforeInit: (): string => {
    try {
      new _SettingsRepo().fetch()
    } catch (error) {
      if (error instanceof Error) {
        return error.message
      }

      return String(error)
    }

    return 'fetch resolved without an error'
  },
  isSameRepoInstanceAcrossSingletonCalls: (): boolean => {
    return settingsRepoSingleton() === settingsRepoSingleton()
  },
  sanitizeRawSettings: (params: { rawSettings: unknown }): SettingsModel => {
    const repo = createTempFileSettingsRepo()

    return repo.sanitize(params)
  },
  settingsSavedDeliveriesAfterInit: async (): Promise<SettingsModel[]> => {
    const repo = createTempFileSettingsRepo()
    const deliveries: SettingsModel[] = []
    const subscription = appEventBusSingleton().subscribe({
      listener: (settings) => {
        deliveries.push(settings)
      },
      type: AppEventType.SETTINGS_SAVED,
    })
    await repo.init()
    subscription.unsubscribe()

    return deliveries
  },
  settingsSavedDeliveriesAfterSave: async (params: { settings: SettingsModel }): Promise<SettingsModel[]> => {
    const { settings } = params
    const repo = createTempFileSettingsRepo()
    const deliveries: SettingsModel[] = []
    const subscription = appEventBusSingleton().subscribe({
      listener: (deliveredSettings) => {
        deliveries.push(deliveredSettings)
      },
      type: AppEventType.SETTINGS_SAVED,
    })
    await repo.save({ settings })
    subscription.unsubscribe()

    return deliveries
  },
}
