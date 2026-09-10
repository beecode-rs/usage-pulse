import type { OS } from '#src/main/util/os-util'
import type { TriggerDay } from '#src/shared/trigger-model'

export interface ISchedulingRegistrationParams {
  days: TriggerDay[]
  executableArgs: string[]
  executablePath: string
  times: string[]
  triggerId: string
}

export interface ISchedulingInspection {
  isRegistered: boolean
}

export interface ISchedulingStrategy {
  getSchedulingPlatform: () => OS
  inspectRegistration: (params: { triggerId: string }) => Promise<ISchedulingInspection>
  readonly isSupported: boolean
  listRegistrationIds: () => Promise<string[]>
  removeRegistration: (params: { triggerId: string }) => Promise<void>
  upsertRegistration: (params: ISchedulingRegistrationParams) => Promise<void>
}
