import { z } from 'zod'

import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { UsageActivityStatus } from '#src/shared/business/enum/usage-activity-status-enum'
import { type MobileWsMessage, UsageWarningReason } from '#src/shared/business/model/mobile-api-model'

const usageWindowSchema = z.object({
  label: z.string(),
  resetAt: z.number().optional(),
  totalAmount: z.number().optional(),
  usedAmount: z.number().optional(),
  usedPercent: z.number(),
  windowMs: z.number().optional(),
})
const providerSnapshotSchema = z.object({
  errorMessage: z.string().optional(),
  fetchedAt: z.number().optional(),
  nextRefreshAt: z.number().optional(),
  providerId: z.enum(ProviderIdMapper),
  refreshIntervalMs: z.number().optional(),
  status: z.enum(UsageActivityStatus),
  trackerId: z.string(),
  trackerName: z.string(),
  usage: z.array(usageWindowSchema).optional(),
})
const usageSnapshotSchema = z.object({
  providers: z.array(providerSnapshotSchema),
})
const sessionTranscriptStatsSchema = z.object({
  aiTitle: z.string(),
  cacheCreationTokens: z.number(),
  cacheReadTokens: z.number(),
  contextSizeTokens: z.number().optional(),
  gitBranch: z.string(),
  inputTokens: z.number(),
  lastActivityAt: z.number().optional(),
  lastPrompt: z.string(),
  model: z.string(),
  outputTokens: z.number(),
  thinkingTokens: z.number(),
  userTurnsCount: z.number(),
  version: z.string(),
})
const sessionInfoSchema = z.object({
  cwd: z.string(),
  hostId: z.string().optional(),
  hostLabel: z.string().optional(),
  kind: z.string(),
  name: z.string(),
  pid: z.number(),
  sessionId: z.string(),
  startedAt: z.number(),
  status: z.enum(SessionStatusMapper),
  transcript: sessionTranscriptStatsSchema.optional(),
})
const unreachableHostSchema = z.object({
  errorMessage: z.string(),
  hostId: z.string(),
  hostLabel: z.string(),
})
const sessionSnapshotSchema = z.object({
  errorMessage: z.string().optional(),
  fetchedAt: z.number(),
  sessions: z.array(sessionInfoSchema),
  unreachableHosts: z.array(unreachableHostSchema),
})
const usageWarningSchema = z.object({
  errorMessage: z.string().optional(),
  reason: z.enum(UsageWarningReason),
  trackerId: z.string(),
  trackerName: z.string(),
  usedPercent: z.number().optional(),
  windowLabel: z.string().optional(),
})
const stateMessageSchema = z.object({
  sessions: sessionSnapshotSchema.nullable(),
  type: z.literal('state'),
  usage: usageSnapshotSchema,
})
const usageSnapshotMessageSchema = z.object({
  type: z.literal('usage-snapshot'),
  usage: usageSnapshotSchema,
})
const sessionsSnapshotMessageSchema = z.object({
  sessions: sessionSnapshotSchema,
  type: z.literal('sessions-snapshot'),
})
const sessionFinishedMessageSchema = z.object({
  session: sessionInfoSchema,
  type: z.literal('session-finished'),
})
const sessionWaitingMessageSchema = z.object({
  session: sessionInfoSchema,
  type: z.literal('session-waiting'),
})
const usageWarningMessageSchema = z.object({
  type: z.literal('usage-warning'),
  warning: usageWarningSchema,
})
const heartbeatMessageSchema = z.object({
  at: z.number(),
  type: z.literal('heartbeat'),
})

export const mobileWsMessageSchema: z.ZodType<MobileWsMessage> = z.discriminatedUnion('type', [
  heartbeatMessageSchema,
  sessionFinishedMessageSchema,
  sessionWaitingMessageSchema,
  sessionsSnapshotMessageSchema,
  stateMessageSchema,
  usageSnapshotMessageSchema,
  usageWarningMessageSchema,
])

export const mobileHealthResponseSchema = z.object({
  appVersion: z.string(),
  ok: z.boolean(),
})

export const mobileStateResponseSchema = z.object({
  sessions: sessionSnapshotSchema.nullable(),
  usage: usageSnapshotSchema,
})
