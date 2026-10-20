import { z } from 'zod'

import { ClaudeAccessTokenSource } from '#src/shared/business/enum/claude-access-token-source-enum'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'
import { SoundNameMapper } from '#src/shared/business/enum/sound-name-mapper-enum'
import type { ScheduleTriggerConfig } from '#src/shared/business/model/schedule-trigger-model'
import type { SettingsData, SshHostConfig, TrackerConfig } from '#src/shared/business/model/settings-model'
import { constant } from '#src/shared/util/constant'

const clampedNumberSchema = (params: { fallback: number; max: number; min: number }): z.ZodType<number> => {
  const { fallback, max, min } = params

  return z
    .number()
    .transform((value) => {
      return Math.round(Math.min(Math.max(value, min), max))
    })
    .catch(fallback)
}

const soundIdSchema = z.enum(SoundNameMapper)
const idSchema = z
  .string()
  .min(1)
  .catch(() => {
    return crypto.randomUUID()
  })
const accessTokenSchema = z.string().catch('')
const accessTokenSourceSchema = z.enum(ClaudeAccessTokenSource).catch(ClaudeAccessTokenSource.MANUAL)
const trackerDefaultsByProviderId = constant.providerCatalog.reduce<
  Partial<Record<ProviderIdMapper, { defaultName: string; defaultRefreshIntervalMs: number }>>
>((trackerDefaults, entry) => {
  return {
    ...trackerDefaults,
    [entry.id]: { defaultName: entry.name, defaultRefreshIntervalMs: entry.defaultRefreshIntervalMs },
  }
}, {})
const triggerDaySchema = z.enum(ScheduleTriggerDayMapper)
const triggerTimeSchema = z.string().refine((time) => {
  return constant.twentyFourHourTimeRegex.test(time)
})
const triggerDaysSchema = z
  .array(z.unknown())
  .transform((days) => {
    const selectedDays = days.reduce<Set<ScheduleTriggerDayMapper>>((selectedDays, day) => {
      const parsedDay = triggerDaySchema.safeParse(day)

      if (parsedDay.success) {
        return new Set([...selectedDays, parsedDay.data])
      }

      return selectedDays
    }, new Set<ScheduleTriggerDayMapper>())

    return constant.scheduleTrigger.days.filter((day) => {
      return selectedDays.has(day)
    })
  })
  .refine((days) => {
    return days.length > 0
  })
const triggerTimesSchema = z
  .array(z.unknown())
  .transform((times) => {
    const validTimes = times.reduce<string[]>((validTimes, time) => {
      const parsedTime = triggerTimeSchema.safeParse(time)

      if (parsedTime.success) {
        return [...validTimes, parsedTime.data]
      }

      return validTimes
    }, [])

    return [...new Set(validTimes)].sort()
  })
  .refine((times) => {
    return times.length > 0
  })
const trimmedNonEmptyStringSchema = z
  .string()
  .transform((value) => {
    return value.trim()
  })
  .refine((value) => {
    return value !== ''
  })
const sshHostSchema = z.object({
  id: idSchema,
  isEnabled: z.boolean().catch(false),
  url: trimmedNonEmptyStringSchema,
})
const triggerSchema = z.object({
  command: trimmedNonEmptyStringSchema,
  createdAt: z.number().catch(() => {
    return Date.now()
  }),
  days: triggerDaysSchema,
  id: idSchema,
  isEnabled: z.boolean().catch(false),
  name: z
    .string()
    .transform((value) => {
      return value.trim()
    })
    .refine((value) => {
      return value !== ''
    })
    .catch('Trigger'),
  timeoutMs: clampedNumberSchema({
    fallback: constant.scheduleTrigger.timeout.defaultMs,
    max: constant.scheduleTrigger.timeout.maxMs,
    min: constant.scheduleTrigger.timeout.minMs,
  }),
  times: triggerTimesSchema,
})
const claudeTrackerSchema = z.object({
  accessToken: accessTokenSchema,
  accessTokenRefreshCommand: trimmedNonEmptyStringSchema.catch(
    constant.claudeSystemAccessToken.cliTokenRefresh.defaultCommand,
  ),
  accessTokenSource: accessTokenSourceSchema,
  id: idSchema,
  isAccessTokenRefreshEnabled: z.boolean().catch(constant.claudeSystemAccessToken.cliTokenRefresh.defaultIsEnabled),
  isAutoRefreshPaused: z.boolean().catch(false),
  name: z
    .string()
    .min(1)
    .catch(trackerDefaultsByProviderId[ProviderIdMapper.CLAUDE]?.defaultName ?? ProviderIdMapper.CLAUDE),
  providerId: z.literal(ProviderIdMapper.CLAUDE),
  refreshIntervalMs: clampedNumberSchema({
    fallback:
      trackerDefaultsByProviderId[ProviderIdMapper.CLAUDE]?.defaultRefreshIntervalMs ??
      constant.trackerRefreshInterval.minMs,
    max: constant.trackerRefreshInterval.maxMs,
    min: constant.trackerRefreshInterval.minMs,
  }),
})
const zaiTrackerSchema = z.object({
  accessToken: accessTokenSchema,
  id: idSchema,
  isAutoRefreshPaused: z.boolean().catch(false),
  name: z
    .string()
    .min(1)
    .catch(trackerDefaultsByProviderId[ProviderIdMapper.ZAI]?.defaultName ?? ProviderIdMapper.ZAI),
  providerId: z.literal(ProviderIdMapper.ZAI),
  refreshIntervalMs: clampedNumberSchema({
    fallback:
      trackerDefaultsByProviderId[ProviderIdMapper.ZAI]?.defaultRefreshIntervalMs ??
      constant.trackerRefreshInterval.minMs,
    max: constant.trackerRefreshInterval.maxMs,
    min: constant.trackerRefreshInterval.minMs,
  }),
})
const trackerSchema = z.discriminatedUnion('providerId', [claudeTrackerSchema, zaiTrackerSchema])
const sshHostsSchema = z
  .array(z.unknown())
  .transform((sshHosts) => {
    return sshHosts.reduce<SshHostConfig[]>((sshHosts, rawSshHost) => {
      const parsedSshHost = sshHostSchema.safeParse(rawSshHost)

      if (parsedSshHost.success) {
        return [...sshHosts, parsedSshHost.data]
      }

      return sshHosts
    }, [])
  })
  .catch(() => {
    return []
  })
const trackersSchema = z
  .array(z.unknown())
  .transform((trackers) => {
    return trackers.reduce<TrackerConfig[]>((trackers, rawTracker) => {
      const parsedTracker = trackerSchema.safeParse(rawTracker)

      if (parsedTracker.success) {
        return [...trackers, parsedTracker.data]
      }

      return trackers
    }, [])
  })
  .catch(() => {
    return []
  })
const triggersSchema = z
  .array(z.unknown())
  .transform((triggers) => {
    return triggers.reduce<ScheduleTriggerConfig[]>((triggers, rawTrigger) => {
      const parsedTrigger = triggerSchema.safeParse(rawTrigger)

      if (parsedTrigger.success) {
        return [...triggers, parsedTrigger.data]
      }

      return triggers
    }, [])
  })
  .catch(() => {
    return []
  })

export const appSettingsSchema: z.ZodType<SettingsData> = z.object({
  isMobileServerEnabled: z.boolean().catch(constant.mobileServer.defaultIsEnabled),
  isSchedulingEnabled: z.boolean().catch(constant.scheduling.defaultIsEnabled),
  isSessionsAutoRefreshPaused: z.boolean().catch(constant.sessionsAutoRefresh.defaultIsPaused),
  mobileServerPort: clampedNumberSchema({
    fallback: constant.mobileServer.defaultPort,
    max: constant.mobileServer.maxPort,
    min: constant.mobileServer.minPort,
  }),
  mobileServerToken: z.string().catch(''),
  sessionFinishedPulseMs: clampedNumberSchema({
    fallback: constant.sessionFinishedPulse.defaultMs,
    max: constant.sessionFinishedPulse.maxMs,
    min: constant.sessionFinishedPulse.minMs,
  }),
  sessionFinishedSoundId: soundIdSchema.catch(constant.sessionFinishedSound.defaultId),
  sessionsRefreshIntervalMs: clampedNumberSchema({
    fallback: constant.sessionsRefreshInterval.defaultMs,
    max: constant.sessionsRefreshInterval.maxMs,
    min: constant.sessionsRefreshInterval.minMs,
  }),
  soundVolumePercent: clampedNumberSchema({
    fallback: constant.soundVolume.defaultPercent,
    max: constant.soundVolume.maxPercent,
    min: constant.soundVolume.minPercent,
  }),
  sshHosts: sshHostsSchema,
  trackers: trackersSchema,
  triggers: triggersSchema,
  waitingSoundId: soundIdSchema.catch(constant.waitingSound.defaultId),
})

const boundedIntSchema = (params: { max: number; min: number }): z.ZodType<number> => {
  const { max, min } = params

  return z.number().int().max(max).min(min)
}

const strictAccessTokenSchema = z.string()
const strictAccessTokenSourceSchema = z.enum(ClaudeAccessTokenSource)
const strictIdSchema = z.string().min(1)
const strictSshHostSchema = z.object({
  id: strictIdSchema,
  isEnabled: z.boolean(),
  url: trimmedNonEmptyStringSchema,
})
const strictTriggerDaysSchema = z
  .array(triggerDaySchema)
  .transform((days) => {
    const selectedDays = new Set(days)

    return constant.scheduleTrigger.days.filter((day) => {
      return selectedDays.has(day)
    })
  })
  .refine((days) => {
    return days.length > 0
  })
const strictTriggerTimesSchema = z
  .array(triggerTimeSchema)
  .transform((times) => {
    return [...new Set(times)].sort()
  })
  .refine((times) => {
    return times.length > 0
  })
const strictTriggerSchema = z.object({
  command: trimmedNonEmptyStringSchema,
  createdAt: z.number(),
  days: strictTriggerDaysSchema,
  id: strictIdSchema,
  isEnabled: z.boolean(),
  name: trimmedNonEmptyStringSchema,
  timeoutMs: boundedIntSchema({
    max: constant.scheduleTrigger.timeout.maxMs,
    min: constant.scheduleTrigger.timeout.minMs,
  }),
  times: strictTriggerTimesSchema,
})
const strictClaudeTrackerSchema = z.object({
  accessToken: strictAccessTokenSchema,
  accessTokenRefreshCommand: trimmedNonEmptyStringSchema,
  accessTokenSource: strictAccessTokenSourceSchema,
  id: strictIdSchema,
  isAccessTokenRefreshEnabled: z.boolean(),
  isAutoRefreshPaused: z.boolean(),
  name: trimmedNonEmptyStringSchema,
  providerId: z.literal(ProviderIdMapper.CLAUDE),
  refreshIntervalMs: boundedIntSchema({
    max: constant.trackerRefreshInterval.maxMs,
    min: constant.trackerRefreshInterval.minMs,
  }),
})
const strictZaiTrackerSchema = z.object({
  accessToken: strictAccessTokenSchema,
  id: strictIdSchema,
  isAutoRefreshPaused: z.boolean(),
  name: trimmedNonEmptyStringSchema,
  providerId: z.literal(ProviderIdMapper.ZAI),
  refreshIntervalMs: boundedIntSchema({
    max: constant.trackerRefreshInterval.maxMs,
    min: constant.trackerRefreshInterval.minMs,
  }),
})
const strictTrackerSchema = z.discriminatedUnion('providerId', [strictClaudeTrackerSchema, strictZaiTrackerSchema])

export const appSettingsStrictSchema = z.object({
  isMobileServerEnabled: z.boolean(),
  isSchedulingEnabled: z.boolean(),
  isSessionsAutoRefreshPaused: z.boolean(),
  mobileServerPort: boundedIntSchema({
    max: constant.mobileServer.maxPort,
    min: constant.mobileServer.minPort,
  }),
  mobileServerToken: z.string(),
  sessionFinishedPulseMs: boundedIntSchema({
    max: constant.sessionFinishedPulse.maxMs,
    min: constant.sessionFinishedPulse.minMs,
  }),
  sessionFinishedSoundId: soundIdSchema,
  sessionsRefreshIntervalMs: boundedIntSchema({
    max: constant.sessionsRefreshInterval.maxMs,
    min: constant.sessionsRefreshInterval.minMs,
  }),
  soundVolumePercent: boundedIntSchema({
    max: constant.soundVolume.maxPercent,
    min: constant.soundVolume.minPercent,
  }),
  sshHosts: z.array(strictSshHostSchema),
  trackers: z.array(strictTrackerSchema),
  triggers: z.array(strictTriggerSchema),
  waitingSoundId: soundIdSchema,
})
