import { vi } from 'vitest'

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { _SessionsPollService } from '#src/main/business/service/sessions/poll-service-singleton'
import { type SessionSnapshot } from '#src/shared/business/model/session-model'
import { SettingsModel } from '#src/shared/business/model/settings-model'

class ProbeSessionsPollService extends _SessionsPollService {
  protected _refreshCount = 0

  readRefreshCount(): number {
    return this._refreshCount
  }

  protected override _refreshSnapshot(): Promise<SessionSnapshot> {
    this._refreshCount += 1
    const snapshot: SessionSnapshot = { fetchedAt: 0, sessions: [], unreachableHosts: [] }
    this._snapshot = snapshot

    return Promise.resolve(snapshot)
  }
}

const resolveScenarioSettings = (params: { intervalMs: number }): SettingsModel => {
  const { intervalMs } = params

  return new SettingsModel({
    settings: {
      ...new SettingsModel(),
      isMobileServerEnabled: false,
      sessionsRefreshIntervalMs: intervalMs,
    },
  })
}

const runPollScenario = async (params: {
  intervalMs: number
  run: (params: { service: ProbeSessionsPollService; settings: SettingsModel }) => Promise<number[]>
}): Promise<number[]> => {
  const { intervalMs, run } = params
  const settings = resolveScenarioSettings({ intervalMs })
  const fetchSpy = vi.spyOn(settingsRepoSingleton(), 'fetch').mockReturnValue(settings)
  vi.useFakeTimers()
  const service = new ProbeSessionsPollService()

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

export const sessionsPollServiceContractHarness = {
  async serverEnabledHiddenMatrixRefreshCounts(params: { intervalMs: number }): Promise<number[]> {
    const { intervalMs } = params

    return await runPollScenario({
      intervalMs,
      run: async ({ service, settings }) => {
        settings.isMobileServerEnabled = true
        await service.start()
        const afterHiddenStart = service.readRefreshCount()

        await advanceScenarioMs({ ms: intervalMs * 2 })
        const afterHiddenAdvance = service.readRefreshCount()

        service.setWindowVisibility({ isVisible: false })
        await advanceScenarioMs({ ms: intervalMs * 2 })
        const afterStillHiddenAdvance = service.readRefreshCount()

        return [afterHiddenStart, afterHiddenAdvance, afterStillHiddenAdvance]
      },
    })
  },

  async serverToggleMatrixRefreshCounts(params: { intervalMs: number }): Promise<number[]> {
    const { intervalMs } = params

    return await runPollScenario({
      intervalMs,
      run: async ({ service, settings }) => {
        await service.start()
        const afterDisabledStart = service.readRefreshCount()

        settings.isMobileServerEnabled = true
        await service.restart()
        const afterEnabledRestart = service.readRefreshCount()

        await advanceScenarioMs({ ms: intervalMs * 2 })
        const afterEnabledAdvance = service.readRefreshCount()

        settings.isMobileServerEnabled = false
        await service.restart()
        const afterDisabledRestart = service.readRefreshCount()

        await advanceScenarioMs({ ms: intervalMs * 2 })
        const afterDisabledAdvance = service.readRefreshCount()

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

  async windowVisibilityMatrixRefreshCounts(params: { intervalMs: number }): Promise<number[]> {
    const { intervalMs } = params

    return await runPollScenario({
      intervalMs,
      run: async ({ service }) => {
        await service.start()
        const afterHiddenStart = service.readRefreshCount()

        service.setWindowVisibility({ isVisible: true })
        await flushAsyncWork()
        const afterVisible = service.readRefreshCount()

        await advanceScenarioMs({ ms: intervalMs * 2 })
        const afterVisibleAdvance = service.readRefreshCount()

        service.setWindowVisibility({ isVisible: false })
        await advanceScenarioMs({ ms: intervalMs * 2 })
        const afterHiddenAdvance = service.readRefreshCount()

        return [afterHiddenStart, afterVisible, afterVisibleAdvance, afterHiddenAdvance]
      },
    })
  },
}
