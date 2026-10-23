import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { vi } from 'vitest'

import { sortedJsonUtil } from '#src/main/business/service/sessions/__tests__/_sorted-json-util'
import { SessionsOpenCodeQueryService } from '#src/main/business/service/sessions/opencode-query-service'
import { constant } from '#src/main/util/constant'

type FetchJsonParams = { headers?: Record<string, string>; timeoutMs?: number; url: string }

const httpUtilFetchJsonState = vi.hoisted(
  (): {
    calls: { authorization: string; timeoutMs: number | undefined; url: string }[]
    rejectedPathnames: string[]
    responsesByPathname: Record<string, unknown>
  } => {
    return { calls: [], rejectedPathnames: [], responsesByPathname: {} }
  },
)

// The real config module snapshots the environment at import time, so
// XDG_STATE_HOME cannot be set per scenario through process.env; the mock
// exposes a getter the scenarios steer through this hoisted state instead.
// The query service is the only config consumer in this module graph, so the
// mock only needs the xdg.stateHome property it reads.
const configState = vi.hoisted((): { xdgStateHome: string | undefined } => {
  return { xdgStateHome: undefined }
})

vi.mock('#src/main/util/config', () => {
  return {
    config: {
      xdg: {
        get stateHome(): string | undefined {
          return configState.xdgStateHome
        },
      },
    },
  }
})

vi.mock('#src/main/util/http-util', () => {
  return {
    httpUtil: {
      fetchJson: (params: FetchJsonParams): Promise<unknown> => {
        const pathname = new URL(params.url).pathname
        const resolvedResponse = mockState.resolveResponse({ pathname })

        httpUtilFetchJsonState.calls.push({
          authorization: params.headers?.Authorization ?? '',
          timeoutMs: params.timeoutMs,
          url: params.url,
        })

        if (httpUtilFetchJsonState.rejectedPathnames.includes(pathname)) {
          return Promise.reject(new Error(`request to ${params.url} failed: simulated request failure`))
        }

        return Promise.resolve(resolvedResponse)
      },
    },
  }
})

type FetchSessionsOutcome = {
  activeJson?: string
  fetchCalls: string[]
  formsJson?: string
  openTabsJson?: string
  permissionsJson?: string
  resolved: 'payloads' | 'undefined'
  sessionsJson?: string
}

type FetchSessionsScenario = {
  activeResponse?: unknown
  formResponse?: unknown
  permissionResponse?: unknown
  rejectActivePath?: boolean
  rejectSessionsPath?: boolean
  serviceFileContent?: string
  sessionsResponse?: unknown
  tabsFileContent?: string
  useXdgStateHome?: boolean
}

const restoreHomeEnvironment = (params: { home: string | undefined; userProfile: string | undefined }): void => {
  const { home, userProfile } = params

  if (home === undefined) {
    delete process.env.HOME
  } else {
    process.env.HOME = home
  }

  if (userProfile === undefined) {
    delete process.env.USERPROFILE
  } else {
    process.env.USERPROFILE = userProfile
  }
}

const resetHttpUtilState = (params: {
  activeResponse: unknown
  formResponse: unknown
  permissionResponse: unknown
  rejectActivePath: boolean
  rejectSessionsPath: boolean
  sessionsResponse: unknown
}): void => {
  const { activeResponse, formResponse, permissionResponse, rejectActivePath, rejectSessionsPath, sessionsResponse } =
    params
  const rejectedPathnames: string[] = []

  if (rejectActivePath) {
    rejectedPathnames.push(constant.sessions.opencodeQuery.activePath)
  }

  if (rejectSessionsPath) {
    rejectedPathnames.push(constant.sessions.opencodeQuery.sessionsPath)
  }

  httpUtilFetchJsonState.calls = []
  httpUtilFetchJsonState.rejectedPathnames = rejectedPathnames
  httpUtilFetchJsonState.responsesByPathname = {
    [constant.sessions.opencodeQuery.activePath]: activeResponse,
    [constant.sessions.opencodeQuery.sessionsPath]: sessionsResponse,
  }
  mockState.formResponse = formResponse
  mockState.permissionResponse = permissionResponse
}

const mockState = {
  formResponse: undefined as unknown,
  permissionResponse: undefined as unknown,
  resolveConfiguredResponse: (params: { response: unknown }): unknown => {
    const { response } = params

    if (response !== undefined) {
      return response
    }

    return { data: [] }
  },
  resolveResponse: (params: { pathname: string }): unknown => {
    const { pathname } = params

    if (pathname.endsWith(constant.sessions.opencodeQuery.formPathSuffix)) {
      return mockState.resolveConfiguredResponse({ response: mockState.formResponse })
    }

    if (pathname.endsWith(constant.sessions.opencodeQuery.permissionPathSuffix)) {
      return mockState.resolveConfiguredResponse({ response: mockState.permissionResponse })
    }

    return httpUtilFetchJsonState.responsesByPathname[pathname]
  },
}

const resolveFetchCallSummaries = (): string[] => {
  return [...httpUtilFetchJsonState.calls]
    .sort((left, right) => {
      return left.url.localeCompare(right.url)
    })
    .map((call) => {
      return `${call.url} | ${call.authorization} | ${String(call.timeoutMs)}`
    })
}

const resolveQueryService = (params: { homeDir: string; useDefaultHome: boolean }): SessionsOpenCodeQueryService => {
  const { homeDir, useDefaultHome } = params

  if (useDefaultHome) {
    return new SessionsOpenCodeQueryService()
  }

  return new SessionsOpenCodeQueryService({ homeDir })
}

const writeServiceFile = async (params: {
  homeDir: string
  serviceFileContent: string
  xdgStateHome: string | undefined
}): Promise<void> => {
  const { homeDir, serviceFileContent, xdgStateHome } = params
  const stateHomeDir = xdgStateHome ?? join(homeDir, '.local', 'state')
  const serviceFilePath = join(stateHomeDir, ...constant.sessions.opencodeQuery.serviceFilePathSegments)

  await mkdir(dirname(serviceFilePath), { recursive: true })
  await writeFile(serviceFilePath, serviceFileContent, 'utf8')
}

const writeDefaultHomeDecoyServiceFile = async (params: { homeDir: string }): Promise<void> => {
  const { homeDir } = params

  await writeServiceFile({
    homeDir,
    serviceFileContent: '{"url":"http://127.0.0.1:1","password":"decoy-password"}',
    xdgStateHome: undefined,
  })
}

const resolveXdgStateHomeDir = async (params: { useXdgStateHome: boolean }): Promise<string | undefined> => {
  const { useXdgStateHome } = params

  if (!useXdgStateHome) {
    return undefined
  }

  return await mkdtemp(join(tmpdir(), 'usage-pulse-opencode-xdg-'))
}

const writeTabsFile = async (params: {
  tabsFileContent: string
  xdgStateHome: string | undefined
  homeDir: string
}): Promise<void> => {
  const { homeDir, tabsFileContent, xdgStateHome } = params
  const stateHomeDir = xdgStateHome ?? join(homeDir, '.local', 'state')
  const tabsFilePath = join(stateHomeDir, ...constant.sessions.opencodeQuery.tabsFilePathSegments)

  await mkdir(dirname(tabsFilePath), { recursive: true })
  await writeFile(tabsFilePath, tabsFileContent, 'utf8')
}

const runFetchSessionsScenario = async (params: {
  scenario: FetchSessionsScenario
  useDefaultHome: boolean
}): Promise<FetchSessionsOutcome> => {
  const { scenario, useDefaultHome } = params
  const {
    activeResponse,
    formResponse,
    permissionResponse,
    rejectActivePath,
    rejectSessionsPath,
    serviceFileContent,
    sessionsResponse,
    tabsFileContent,
    useXdgStateHome,
  } = scenario
  const tempHomeDir = await mkdtemp(join(tmpdir(), 'usage-pulse-opencode-home-'))
  const xdgStateHomeDir = await resolveXdgStateHomeDir({ useXdgStateHome: useXdgStateHome === true })
  const originalHome = process.env.HOME
  const originalUserProfile = process.env.USERPROFILE

  resetHttpUtilState({
    activeResponse,
    formResponse,
    permissionResponse,
    rejectActivePath: rejectActivePath === true,
    rejectSessionsPath: rejectSessionsPath === true,
    sessionsResponse,
  })
  configState.xdgStateHome = xdgStateHomeDir

  if (serviceFileContent !== undefined) {
    await writeServiceFile({ homeDir: tempHomeDir, serviceFileContent, xdgStateHome: xdgStateHomeDir })

    if (xdgStateHomeDir !== undefined) {
      await writeDefaultHomeDecoyServiceFile({ homeDir: tempHomeDir })
    }
  }

  if (tabsFileContent !== undefined) {
    await writeTabsFile({ homeDir: tempHomeDir, tabsFileContent, xdgStateHome: xdgStateHomeDir })
  }

  try {
    if (useDefaultHome) {
      process.env.HOME = tempHomeDir
      process.env.USERPROFILE = tempHomeDir
    }

    const service = resolveQueryService({ homeDir: tempHomeDir, useDefaultHome })
    const payload = await service.fetchSessions()

    if (payload === undefined) {
      return { fetchCalls: resolveFetchCallSummaries(), resolved: 'undefined' }
    }

    return {
      activeJson: sortedJsonUtil.stringify({ value: payload.active }),
      fetchCalls: resolveFetchCallSummaries(),
      formsJson: sortedJsonUtil.stringify({ value: payload.forms }),
      openTabsJson: sortedJsonUtil.stringify({ value: payload.openTabs ?? null }),
      permissionsJson: sortedJsonUtil.stringify({ value: payload.permissions }),
      resolved: 'payloads',
      sessionsJson: sortedJsonUtil.stringify({ value: payload.sessions }),
    }
  } finally {
    configState.xdgStateHome = undefined
    restoreHomeEnvironment({ home: originalHome, userProfile: originalUserProfile })
    await rm(tempHomeDir, { force: true, recursive: true })

    if (xdgStateHomeDir !== undefined) {
      await rm(xdgStateHomeDir, { force: true, recursive: true })
    }
  }
}

export const sessionsOpenCodeQueryServiceContractHarness = {
  fetchSessions: async (params: FetchSessionsScenario): Promise<FetchSessionsOutcome> => {
    return await runFetchSessionsScenario({ scenario: params, useDefaultHome: false })
  },
  fetchSessionsUsingDefaultHome: async (params: FetchSessionsScenario): Promise<FetchSessionsOutcome> => {
    return await runFetchSessionsScenario({ scenario: params, useDefaultHome: true })
  },
}
