import { vi } from 'vitest'
import { WebSocket } from 'ws'

vi.mock('electron', () => ({
  app: {
    getPath: (): string => '/tmp/usage-pulse-mobile-server-contract',
    getVersion: (): string => '0.6.1-test',
  },
}))

import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { settingsRepoSingleton } from '#src/main/business/repo/settings-repo-singleton'
import { _MobileServerService } from '#src/main/business/service/mobile-server-service-singleton'
import { usagePollServiceSingleton } from '#src/main/business/service/usage-poll-service-singleton'
import { appEventBusSingleton } from '#src/main/lib/app-event-bus-singleton'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { UsageActivityStatus } from '#src/shared/business/enum/usage-activity-status-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'
import { SettingsModel, type TrackerConfig } from '#src/shared/business/model/settings-model'
import { type UsageSnapshot } from '#src/shared/business/model/usage-model'

const TEST_TOKEN = 'test-token'

const zaiTrackerFixture: TrackerConfig = {
  accessToken: '',
  id: 'tracker-main',
  isAutoRefreshPaused: false,
  name: 'z.ai',
  providerId: ProviderIdMapper.ZAI,
  refreshIntervalMs: 60_000,
}

const sessionWaitingFixture: SessionInfo = {
  cwd: '/home/user/proj-a',
  kind: 'claude-code',
  name: 'session-a',
  pid: 1234,
  sessionId: 's-a',
  startedAt: 1_726_000_000_000,
  status: SessionStatusMapper.WAITING,
}

const usageSnapshotFixture: UsageSnapshot = {
  providers: [
    {
      fetchedAt: 1_726_000_000_000,
      providerId: ProviderIdMapper.CLAUDE,
      status: UsageActivityStatus.OK,
      trackerId: 'tracker-main',
      trackerName: 'Claude',
      usage: [{ label: '5h window', usedPercent: 50 }],
    },
  ],
}

const withStartedService = async <RESULT>(params: {
  run: (params: { service: _MobileServerService }) => Promise<RESULT>
  trackers?: TrackerConfig[]
}): Promise<RESULT> => {
  const { run, trackers = [] } = params
  const settings = new SettingsModel({
    settings: {
      ...new SettingsModel(),
      isMobileServerEnabled: true,
      mobileServerPort: 0,
      mobileServerToken: TEST_TOKEN,
      trackers,
    },
  })
  const fetchSpy = vi.spyOn(settingsRepoSingleton(), 'fetch').mockReturnValue(settings)
  const service = new _MobileServerService()
  await service.start()

  try {
    return await run({ service })
  } finally {
    await service.stop()
    fetchSpy.mockRestore()
  }
}

const resolveFetchInit = (params: { body?: unknown; headers: Record<string, string>; method: string }): RequestInit => {
  const { body, headers, method } = params

  if (body === undefined) {
    return { headers, method }
  }

  const jsonHeaders: Record<string, string> = { ...headers }
  jsonHeaders['content-type'] = 'application/json'

  return { body: JSON.stringify(body), headers: jsonHeaders, method }
}

const fetchApiResponse = async (params: {
  body?: unknown
  method?: string
  path: string
  port: number
  tokenVia: string
}): Promise<{ body: unknown; status: number }> => {
  const { body, method = 'GET', path, port, tokenVia } = params
  const headers: Record<string, string> = {}
  let url = `http://127.0.0.1:${String(port)}${path}`

  if (tokenVia === 'bearer') {
    headers.authorization = `Bearer ${TEST_TOKEN}`
  }

  if (tokenVia === 'query') {
    url = `${url}?token=${TEST_TOKEN}`
  }

  const response = await fetch(url, resolveFetchInit({ body, headers, method }))

  return { body: await response.json(), status: response.status }
}

const collectWsMessages = (params: {
  count: number
  onOpen: () => void
  port: number
  token: string
}): Promise<unknown[]> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${String(params.port)}/ws?token=${params.token}`)
    const messages: unknown[] = []
    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('timed out waiting for websocket messages'))
    }, 2_000)
    const cleanup = (): void => {
      clearTimeout(timeoutId)
      ws.removeAllListeners()
      ws.close()
    }

    ws.on('error', () => {
      return undefined
    })
    ws.on('message', (data) => {
      messages.push(JSON.parse((data as Buffer).toString()))

      if (messages.length >= params.count) {
        cleanup()
        resolve(messages)
      }
    })
    ws.on('close', () => {
      cleanup()
      resolve(messages)
    })
    ws.on('open', () => {
      params.onOpen()
    })
  })
}

const waitForConnectedDeviceCount = (params: { count: number; service: _MobileServerService }): Promise<number> => {
  return new Promise((resolve) => {
    const intervalId = setInterval(() => {
      if (params.service.getConnectedDevices().length !== params.count) {
        return
      }

      cleanup()
      resolve(params.count)
    }, 20)
    const timeoutId = setTimeout(() => {
      cleanup()
      resolve(params.service.getConnectedDevices().length)
    }, 2_000)
    const cleanup = (): void => {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
    }
  })
}

export const mobileServerServiceContractHarness = {
  async connectedDevicesAfterConnect(params: { token: string }): Promise<unknown[]> {
    const { token } = params

    return await withStartedService({
      run: async ({ service }) => {
        await collectWsMessages({
          count: 1,
          onOpen: () => undefined,
          port: service.getPort() ?? 0,
          token,
        })

        return service.getConnectedDevices().map((device) => {
          return {
            hasAddress: device.address !== '',
            hasConnectedAt: device.connectedAt > 0,
            hasId: device.id !== '',
            hasUserAgent: device.userAgent !== '',
          }
        })
      },
    })
  },

  async connectedDevicesAfterDisconnect(params: { token: string }): Promise<number> {
    const { token } = params

    return await withStartedService({
      run: async ({ service }) => {
        await collectWsMessages({
          count: 1,
          onOpen: () => undefined,
          port: service.getPort() ?? 0,
          token,
        })

        return await waitForConnectedDeviceCount({ count: 0, service })
      },
    })
  },

  async devicesChangedEventCounts(params: { token: string }): Promise<number[]> {
    const { token } = params

    return await withStartedService({
      run: async ({ service }) => {
        const capturedDeviceCounts: number[] = []
        const subscription = appEventBusSingleton().subscribe({
          listener: (devices) => {
            capturedDeviceCounts.push(devices.length)
          },
          type: AppEventType.MOBILE_DEVICES_CHANGED,
        })

        try {
          await collectWsMessages({
            count: 1,
            onOpen: () => undefined,
            port: service.getPort() ?? 0,
            token,
          })
          await waitForConnectedDeviceCount({ count: 0, service })

          return capturedDeviceCounts
        } finally {
          subscription.unsubscribe()
        }
      },
    })
  },

  async firstWsMessage(params: { token: string }): Promise<unknown> {
    const { token } = params

    return await withStartedService({
      run: async ({ service }) => {
        const messages = await collectWsMessages({
          count: 1,
          onOpen: () => undefined,
          port: service.getPort() ?? 0,
          token,
        })

        return messages[0]
      },
    })
  },

  async healthResponse(params: { tokenVia: string }): Promise<{ body: unknown; status: number }> {
    const { tokenVia } = params

    return await withStartedService({
      run: async ({ service }) => {
        return await fetchApiResponse({ path: '/api/health', port: service.getPort() ?? 0, tokenVia })
      },
    })
  },

  async sessionWaitingMessage(params: { token: string }): Promise<unknown> {
    const { token } = params

    return await withStartedService({
      run: async ({ service }) => {
        const messages = await collectWsMessages({
          count: 2,
          onOpen: () => {
            appEventBusSingleton().emit({ payload: sessionWaitingFixture, type: AppEventType.SESSION_WAITING })
          },
          port: service.getPort() ?? 0,
          token,
        })

        return messages[1]
      },
    })
  },

  async stateResponse(params: { tokenVia: string }): Promise<{ body: unknown; status: number }> {
    const { tokenVia } = params

    return await withStartedService({
      run: async ({ service }) => {
        return await fetchApiResponse({ path: '/api/state', port: service.getPort() ?? 0, tokenVia })
      },
    })
  },

  async trackerRefreshResponse(params: {
    body: unknown
    tokenVia: string
  }): Promise<{ body: unknown; refreshedTrackerIds: string[]; status: number }> {
    const { body, tokenVia } = params

    return await withStartedService({
      run: async ({ service }) => {
        const refreshedTrackerIds: string[] = []
        const refreshTrackerSpy = vi
          .spyOn(usagePollServiceSingleton(), 'refreshTracker')
          .mockImplementation((callParams: { trackerId: string }) => {
            refreshedTrackerIds.push(callParams.trackerId)

            return Promise.resolve()
          })

        try {
          const response = await fetchApiResponse({
            body,
            method: 'POST',
            path: '/api/tracker/refresh',
            port: service.getPort() ?? 0,
            tokenVia,
          })

          return { body: response.body, refreshedTrackerIds, status: response.status }
        } finally {
          refreshTrackerSpy.mockRestore()
        }
      },
    })
  },

  async trackerSetPausedResponse(params: {
    body: unknown
    tokenVia: string
  }): Promise<{ body: unknown; savedPausedFlags: boolean[]; status: number }> {
    const { body, tokenVia } = params

    return await withStartedService({
      run: async ({ service }) => {
        const savedPausedFlags: boolean[] = []
        const saveSpy = vi
          .spyOn(settingsRepoSingleton(), 'save')
          .mockImplementation((callParams: { settings: SettingsModel }) => {
            savedPausedFlags.push(
              ...callParams.settings.trackers.map((tracker) => {
                return tracker.isAutoRefreshPaused
              }),
            )

            return Promise.resolve()
          })

        try {
          const response = await fetchApiResponse({
            body,
            method: 'POST',
            path: '/api/tracker/set-paused',
            port: service.getPort() ?? 0,
            tokenVia,
          })

          return { body: response.body, savedPausedFlags, status: response.status }
        } finally {
          saveSpy.mockRestore()
        }
      },
      trackers: [zaiTrackerFixture],
    })
  },

  async unknownRouteResponse(params: { tokenVia: string }): Promise<{ body: unknown; status: number }> {
    const { tokenVia } = params

    return await withStartedService({
      run: async ({ service }) => {
        return await fetchApiResponse({ path: '/api/unknown', port: service.getPort() ?? 0, tokenVia })
      },
    })
  },

  async usageSnapshotMessage(params: { token: string }): Promise<unknown> {
    const { token } = params

    return await withStartedService({
      run: async ({ service }) => {
        const messages = await collectWsMessages({
          count: 2,
          onOpen: () => {
            appEventBusSingleton().emit({ payload: usageSnapshotFixture, type: AppEventType.USAGE_SNAPSHOT })
          },
          port: service.getPort() ?? 0,
          token,
        })

        return messages[1]
      },
    })
  },

  async wrongTokenUpgradeClosed(params: { token: string }): Promise<boolean> {
    const { token } = params

    return await withStartedService({
      run: async ({ service }) => {
        const messages = await collectWsMessages({
          count: 1,
          onOpen: () => undefined,
          port: service.getPort() ?? 0,
          token,
        })

        return messages.length === 0
      },
    })
  },
}
