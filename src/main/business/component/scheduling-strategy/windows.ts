import type {
  SchedulingInspection,
  SchedulingRegistrationParams,
  SchedulingStrategy,
} from '#src/main/business/component/scheduling-strategy/scheduling-strategy'
import { OS } from '#src/shared/business/enum/os-enum'

export class SchedulingStrategyWindows implements SchedulingStrategy {
  readonly isSupported = false

  getSchedulingPlatform(): OS {
    return OS.WINDOWS
  }

  inspectRegistration(_params: { triggerId: string }): Promise<SchedulingInspection> {
    return Promise.reject(new Error('OS scheduling is not implemented on Windows yet'))
  }

  listRegistrationIds(): Promise<string[]> {
    return Promise.reject(new Error('OS scheduling is not implemented on Windows yet'))
  }

  removeRegistration(_params: { triggerId: string }): Promise<void> {
    return Promise.reject(new Error('OS scheduling is not implemented on Windows yet'))
  }

  upsertRegistration(_params: SchedulingRegistrationParams): Promise<void> {
    return Promise.reject(new Error('OS scheduling is not implemented on Windows yet'))
  }
}
