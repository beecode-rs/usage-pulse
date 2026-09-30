import { vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: (): string => '/tmp' } }))

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { _UsagePollService } from '#src/main/business/service/usage-poll-service-singleton'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { UsageActivityStatus } from '#src/shared/business/enum/usage-activity-status-enum'
import { SettingsModel, type TrackerConfig } from '#src/shared/business/model/settings-model'
import { type ProviderSnapshot } from '#src/shared/business/model/usage-model'

class ProbeUsagePollService extends _UsagePollService {
  protected _pollCount = 0

  readPollCount(): number {
    return this._pollCount
  }

  protected override _hydratePersistedSnapshots(): Promise<void> {
    return Promise.resolve(undefined)
  }

  protected override _persistSnapshots(): void {
    return undefined
  }

  protected override _pollTracker(params: { tracker: TrackerConfig }): Promise<ProviderSnapshot> {
    const { tracker } = params
    this._pollCount += 1

    return Promise.resolve({
      fetchedAt: Date.now(),
      providerId: tracker.providerId,
      status: UsageActivityStatus.OK,
      trackerId: tracker.id,
      trackerName: tracker.name,
      usage: [],
    })
  }
}

const resolveScenarioSettings = (params: { intervalMs: number }): SettingsModel => {
  const { intervalMs } = params

  return new SettingsModel({
    settings: {
      ...new SettingsModel(),
      isMobileServerEnabled: false,
      trackers: [
        {
          accessToken: 'scenario-access-token',
          id: 'scenario-tracker',
          isAutoRefreshPaused: false,
          name: 'Scenario Tracker',
          providerId: ProviderIdMapper.ZAI,
          refreshIntervalMs: intervalMs,
        },
      ],
    },
  })
}

const runPollScenario = async (params: {
  intervalMs: number
  run: (params: { service: ProbeUsagePollService; settings: SettingsModel }) => Promise<number[]>
}): Promise<number[]> => {
  const { intervalMs, run } = params
  const settings = resolveScenarioSettings({ intervalMs })
  const fetchSpy = vi.spyOn(settingsRepoSingleton(), 'fetch').mockReturnValue(settings)
  vi.useFakeTimers()
  const service = new ProbeUsagePollService()

  try {
    return await run({ service, settings })
  } finally {
    service.stop()
    fetchSpy.mockRestore()
    vi.useRealTimers()
  }
}

const flushAsyncWork = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0)
}

const advanceScenarioMs = async (params: { ms: number }): Promise<void> => {
  const { ms } = params
  await vi.advanceTimersByTimeAsync(ms)
}

export const usagePollServiceContractHarness = {
  async serverEnabledHiddenMatrixPollCounts(params: { intervalMs: number }): Promise<number[]> {
    const { intervalMs } = params

    return await runPollScenario({
      intervalMs,
      run: async ({ service, settings }) => {
        settings.isMobileServerEnabled = true
        await service.start()
        const afterHiddenStart = service.readPollCount()

        await advanceScenarioMs({ ms: intervalMs * 2 })
        const afterHiddenAdvance = service.readPollCount()

        service.setWindowVisibility({ isVisible: false })
        await advanceScenarioMs({ ms: intervalMs * 2 })
        const afterStillHiddenAdvance = service.readPollCount()

        return [afterHiddenStart, afterHiddenAdvance, afterStillHiddenAdvance]
      },
    })
  },

  async serverToggleMatrixPollCounts(params: { intervalMs: number }): Promise<number[]> {
    const { intervalMs } = params

    return await runPollScenario({
      intervalMs,
      run: async ({ service, settings }) => {
        await service.start()
        const afterDisabledStart = service.readPollCount()

        settings.isMobileServerEnabled = true
        await service.restart()
        const afterEnabledRestart = service.readPollCount()

        await advanceScenarioMs({ ms: intervalMs * 2 })
        const afterEnabledAdvance = service.readPollCount()

        settings.isMobileServerEnabled = false
        await service.restart()
        const afterDisabledRestart = service.readPollCount()

        await advanceScenarioMs({ ms: intervalMs * 2 })
        const afterDisabledAdvance = service.readPollCount()

        return [
          afterDisabledStart,
          afterEnabledRestart,
          afterEnabledAdvance,
          afterDisabledRestart,
          afterDisabledAdvance,
        ]
      },
    })
  },

  async windowVisibilityMatrixPollCounts(params: { intervalMs: number }): Promise<number[]> {
    const { intervalMs } = params

    return await runPollScenario({
      intervalMs,
      run: async ({ service }) => {
        await service.start()
        const afterHiddenStart = service.readPollCount()

        service.setWindowVisibility({ isVisible: true })
        await flushAsyncWork()
        const afterVisible = service.readPollCount()

        await advanceScenarioMs({ ms: intervalMs * 2 })
        const afterVisibleAdvance = service.readPollCount()

        service.setWindowVisibility({ isVisible: false })
        await advanceScenarioMs({ ms: intervalMs * 2 })
        const afterHiddenAdvance = service.readPollCount()

        return [afterHiddenStart, afterVisible, afterVisibleAdvance, afterHiddenAdvance]
      },
    })
  },
}
