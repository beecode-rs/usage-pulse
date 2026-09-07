import type { OS } from '#src/shared/business/enum/os-enum'
import type { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'

export type SchedulingRegistrationParams = {
  days: ScheduleTriggerDayMapper[]
  executableArgs: string[]
  executablePath: string
  times: string[]
  triggerId: string
}

export type SchedulingInspection = {
  isRegistered: boolean
}

export interface SchedulingStrategy {
  getSchedulingPlatform: () => OS
  inspectRegistration: (params: { triggerId: string }) => Promise<SchedulingInspection>
  readonly isSupported: boolean
  listRegistrationIds: () => Promise<string[]>
  removeRegistration: (params: { triggerId: string }) => Promise<void>
  upsertRegistration: (params: SchedulingRegistrationParams) => Promise<void>
}
