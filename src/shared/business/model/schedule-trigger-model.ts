import { type OS } from '#src/shared/business/enum/os-enum'
import { type ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'
import { type ScheduleTriggerRunPhaseMapper } from '#src/shared/business/enum/schedule-trigger-run-phase-mapper-enum'
import { type ScheduleTriggerRunSkipReasonMapper } from '#src/shared/business/enum/schedule-trigger-run-skip-reason-mapper-enum'
import { type ScheduleTriggerRunSourceMapper } from '#src/shared/business/enum/schedule-trigger-run-source-mapper-enum'

export type ScheduleTriggerConfig = {
  command: string
  createdAt: number
  days: ScheduleTriggerDayMapper[]
  id: string
  isEnabled: boolean
  name: string
  times: string[]
  timeoutMs: number
}

export type ScheduleTriggerPreset = {
  days: ScheduleTriggerDayMapper[]
  times: string[]
}

export type SchedulingInfo = {
  isSupported: boolean
  platform: OS
}

export type ScheduleTriggerRegistrationHealth = {
  isRegistered: boolean
  triggerId: string
}

export type ScheduleTriggerRunLogEntry = {
  durationMs: number
  eventId: string
  exitCode: number
  outputSnippet: string
  phase: ScheduleTriggerRunPhaseMapper
  skipReason: ScheduleTriggerRunSkipReasonMapper | ''
  slot: string
  timestamp: string
  trigger: ScheduleTriggerRunSourceMapper
  triggerId: string
  triggerName: string
}
