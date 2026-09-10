import { type OS } from '#src/shared/os-model'

export type TriggerDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export const TRIGGER_DAYS: TriggerDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export const DEFAULT_TRIGGER_TIMEOUT_MS = 5 * 60 * 1000

export const MIN_TRIGGER_TIMEOUT_MS = 60 * 1000

export const MAX_TRIGGER_TIMEOUT_MS = 60 * 60 * 1000

export const MIN_TRIGGER_TIMEOUT_MINUTES = MIN_TRIGGER_TIMEOUT_MS / 60_000

export const MAX_TRIGGER_TIMEOUT_MINUTES = MAX_TRIGGER_TIMEOUT_MS / 60_000

export interface ITriggerConfig {
  command: string
  createdAt: number
  days: TriggerDay[]
  id: string
  isEnabled: boolean
  name: string
  times: string[]
  timeoutMs: number
}

export interface ITriggerPreset {
  days: TriggerDay[]
  times: string[]
}

export const MAX_WINDOW_TRIGGER_PRESET: ITriggerPreset = {
  days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  times: ['07:00', '12:02', '17:05'],
}

export interface ISchedulingInfo {
  isSupported: boolean
  platform: OS
}

export interface ITriggerRegistrationHealth {
  isRegistered: boolean
  triggerId: string
}

export type TriggerRunPhase = 'finished' | 'skipped' | 'started'

export type TriggerRunSkipReason = 'disabled' | 'not-found' | 'not-scheduled-day' | 'stale'

export type TriggerRunSource = 'manual' | 'os-schedule'

export interface ITriggerRunLogEntry {
  durationMs: number
  eventId: string
  exitCode: number
  outputSnippet: string
  phase: TriggerRunPhase
  skipReason: TriggerRunSkipReason | ''
  slot: string
  timestamp: string
  trigger: TriggerRunSource
  triggerId: string
  triggerName: string
}

export const DEFAULT_TRIGGER_STALE_SKIP_MINUTES = 30

export const TRIGGER_RUN_EXIT_CODE_TIMED_OUT = 124

export const TRIGGER_RUN_LOG_READ_ENTRY_LIMIT = 200

export const TRIGGER_RUN_LOG_ROTATE_KEEP_LINE_COUNT = 2000

export const TRIGGER_RUN_LOG_ROTATE_MAX_BYTES = 5 * 1024 * 1024

export const TRIGGER_RUN_LOG_SNIPPET_MAX_LENGTH = 2048
