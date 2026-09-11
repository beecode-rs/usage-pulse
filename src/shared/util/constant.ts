import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'
import { SoundNameMapper } from '#src/shared/business/enum/sound-name-mapper-enum'
import type { ProviderCatalogEntry } from '#src/shared/business/model/provider-catalog-model'
import type { ScheduleTriggerPreset } from '#src/shared/business/model/schedule-trigger-model'

const fiveHourWindowMs = 5 * 60 * 60 * 1000

const maxWindowScheduleTriggerPreset: ScheduleTriggerPreset = {
  days: [
    ScheduleTriggerDayMapper.MONDAY,
    ScheduleTriggerDayMapper.TUESDAY,
    ScheduleTriggerDayMapper.WEDNESDAY,
    ScheduleTriggerDayMapper.THURSDAY,
    ScheduleTriggerDayMapper.FRIDAY,
  ],
  times: ['07:00', '12:02', '17:05'],
}

const providerCatalog: ProviderCatalogEntry[] = [
  {
    defaultRefreshIntervalMs: 900_000,
    description: 'Usage limits from your Claude coding plan',
    id: ProviderIdMapper.CLAUDE,
    name: 'Claude',
  },
  {
    defaultRefreshIntervalMs: 900_000,
    description: 'Usage limits from your GLM coding plan',
    id: ProviderIdMapper.ZAI,
    name: 'z.ai',
  },
  {
    defaultRefreshIntervalMs: 3_600_000,
    description: 'Dev-only test tracker that shows a native popup when its schedule fires',
    id: ProviderIdMapper.DUMMY,
    name: 'Dummy',
  },
]

export const constant = {
  fiveHourWindowMs,
  legacyClaudeTokenSourceSystem: 'system',
  maxWindowScheduleTriggerPreset,
  planner: {
    dayMs: 86_400_000,
    firstTrigger: {
      defaultMs: 25_200_000,
    },
    lunchDurationMs: 3_600_000,
    lunchStart: {
      defaultMs: 46_800_000,
    },
    windowDurationMs: fiveHourWindowMs,
    workDuration: {
      defaultMs: 28_800_000,
    },
    workStart: {
      defaultMs: 36_000_000,
    },
  },
  providerCatalog,
  scheduleTrigger: {
    days: Object.values(ScheduleTriggerDayMapper),
    run: {
      exitCodeTimedOut: 124,
      log: {
        readEntryLimit: 200,
        rotateKeepLineCount: 2000,
        rotateMaxBytes: 5 * 1024 * 1024,
        snippetMaxLength: 2048,
      },
    },
    staleSkip: {
      defaultMs: 1_800_000,
    },
    timeout: {
      defaultMs: 5 * 60 * 1000,
      maxMs: 60 * 60 * 1000,
      minMs: 60 * 1000,
    },
  },
  scheduling: {
    defaultIsEnabled: false,
  },
  sessionFinishedPulse: {
    defaultMs: 10_000,
    maxMs: 60_000,
    minMs: 0,
  },
  sessionFinishedSound: {
    defaultId: SoundNameMapper.SUCCESS,
  },
  sessionsAutoRefresh: {
    defaultIsPaused: false,
  },
  sessionSoundIds: Object.values(SoundNameMapper),
  sessionsRefreshInterval: {
    defaultMs: 5_000,
    maxMs: 300_000,
    minMs: 2_000,
  },
  sevenDayWindowMs: 7 * 24 * 60 * 60 * 1000,
  soundVolume: {
    defaultPercent: 40,
    maxPercent: 100,
    minPercent: 0,
  },
  thirtyDayWindowMs: 30 * 24 * 60 * 60 * 1000,
  trackerRefreshInterval: {
    maxMs: 3_600_000,
    minMs: 60_000,
  },
  twentyFourHourTimeRegex: /^([01]\d|2[0-3]):[0-5]\d$/,
  waitingSound: {
    defaultId: SoundNameMapper.CHIME,
  },
}
