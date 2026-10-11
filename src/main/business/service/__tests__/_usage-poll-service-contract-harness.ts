import { vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: (): string => '/tmp' } }))

import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { _UsagePollService } from '#src/main/business/service/usage-poll-service-singleton'
import { type UsageProvider } from '#src/main/business/service/usage-provider/usage-provider'
import { errorUtil } from '#src/main/util/error-util'
import { type ClaudeAccessTokenSource } from '#src/shared/business/enum/claude-access-token-source-enum'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { UsageActivityStatus } from '#src/shared/business/enum/usage-activity-status-enum'
import { SettingsModel, type TrackerConfig } from '#src/shared/business/model/settings-model'
import { type ProviderSnapshot, type UsageWindow } from '#src/shared/business/model/usage-model'
import { constant } from '#src/shared/util/constant'

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

class StubClaudeUsageProvider implements UsageProvider {
  fetchCallsCount = 0
  firstCallErrorStatus: number | undefined
  lastAccessToken = ''

  constructor(params: { firstCallErrorStatus?: number }) {
    this.firstCallErrorStatus = params.firstCallErrorStatus
  }

  fetchUsage(params: { accessToken: string }): Promise<UsageWindow[]> {
    const { accessToken } = params
    this.fetchCallsCount += 1
    this.lastAccessToken = accessToken

    if (this.fetchCallsCount === 1 && this.firstCallErrorStatus !== undefined) {
      return Promise.reject(this._resolveFirstCallError())
    }

    return Promise.resolve([{ label: '5-hour window', usedPercent: 12.5, windowMs: constant.fiveHourWindowMs }])
  }

  getProviderId(): ProviderIdMapper {
    return ProviderIdMapper.CLAUDE
  }

  protected _resolveFirstCallError(): Error {
    return Object.assign(new Error(`request failed with status ${String(this.firstCallErrorStatus)} Unauthorized`), {
      status: this.firstCallErrorStatus,
    })
  }
}

class TokenRefreshProbeService extends _UsagePollService {
  isRefreshCalled = false
  refreshCommandUsed = ''

  constructor(params: { provider: UsageProvider }) {
    super()
    this._providers[ProviderIdMapper.CLAUDE] = params.provider
  }

  async fetchUsageWithTokenRefresh(params: { accessToken: string; tracker: TrackerConfig }): Promise<UsageWindow[]> {
    return await this._fetchUsageWithTokenRefresh(params)
  }

  protected override _refreshClaudeSystemAccessToken(params: { command: string }): Promise<string> {
    const { command } = params
    this.isRefreshCalled = true
    this.refreshCommandUsed = command

    return Promise.resolve('refreshed-access-token')
  }
}

const resolveClaudeTracker = (params: {
  accessTokenRefreshCommand: string
  accessTokenSource: ClaudeAccessTokenSource
  isAccessTokenRefreshEnabled: boolean
}): TrackerConfig => {
  const { accessTokenRefreshCommand, accessTokenSource, isAccessTokenRefreshEnabled } = params

  return {
    accessToken: '',
    accessTokenRefreshCommand,
    accessTokenSource,
    id: 'scenario-claude-tracker',
    isAccessTokenRefreshEnabled,
    isAutoRefreshPaused: false,
    name: 'Scenario Claude',
    providerId: ProviderIdMapper.CLAUDE,
    refreshIntervalMs: 60_000,
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
  async claudeTokenRefreshFallbackOutcome(params: {
    accessTokenRefreshCommand: string
    accessTokenSource: ClaudeAccessTokenSource
    firstCallErrorStatus?: number
    isAccessTokenRefreshEnabled?: boolean
  }): Promise<{
    fetchCallsCount: number
    isRefreshCalled: boolean
    lastAccessToken: string
    outcomeErrorMessage: string
    refreshCommandUsed: string
  }> {
    const { accessTokenRefreshCommand, accessTokenSource, firstCallErrorStatus, isAccessTokenRefreshEnabled } = params
    const provider = new StubClaudeUsageProvider({ firstCallErrorStatus })
    const service = new TokenRefreshProbeService({ provider })
    const tracker = resolveClaudeTracker({
      accessTokenRefreshCommand,
      accessTokenSource,
      isAccessTokenRefreshEnabled: isAccessTokenRefreshEnabled ?? false,
    })
    const outcome = await service.fetchUsageWithTokenRefresh({ accessToken: 'stale-access-token', tracker }).then(
      () => {
        return { outcomeErrorMessage: '' }
      },
      (error: unknown) => {
        return { outcomeErrorMessage: errorUtil.resolveMessage(error) }
      },
    )

    return {
      fetchCallsCount: provider.fetchCallsCount,
      isRefreshCalled: service.isRefreshCalled,
      lastAccessToken: provider.lastAccessToken,
      outcomeErrorMessage: outcome.outcomeErrorMessage,
      refreshCommandUsed: service.refreshCommandUsed,
    }
  },

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
