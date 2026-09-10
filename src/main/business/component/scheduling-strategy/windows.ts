import type {
  ISchedulingInspection,
  ISchedulingRegistrationParams,
  ISchedulingStrategy,
} from '#src/main/business/component/scheduling-strategy/scheduling-strategy'
import { OS } from '#src/main/util/os-util'

export class SchedulingStrategyWindows implements ISchedulingStrategy {
  readonly isSupported = false

  getSchedulingPlatform(): OS {
    return OS.WINDOWS
  }

  inspectRegistration(_params: { triggerId: string }): Promise<ISchedulingInspection> {
    return Promise.reject(new Error('OS scheduling is not implemented on Windows yet'))
  }

  listRegistrationIds(): Promise<string[]> {
    return Promise.reject(new Error('OS scheduling is not implemented on Windows yet'))
  }

  removeRegistration(_params: { triggerId: string }): Promise<void> {
    return Promise.reject(new Error('OS scheduling is not implemented on Windows yet'))
  }

  upsertRegistration(_params: ISchedulingRegistrationParams): Promise<void> {
    return Promise.reject(new Error('OS scheduling is not implemented on Windows yet'))
  }
}
