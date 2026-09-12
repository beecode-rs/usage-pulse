import type {
  ScheduleTriggerRegistrationHealth,
  ScheduleTriggerRunLogEntry,
  SchedulingInfo,
} from '#src/shared/business/model/schedule-trigger-model'
import type { AppSettings } from '#src/shared/business/model/settings-model'

export const schedulingClientService = {
  clearTriggerRunLogs: (params: { triggerId: string }): Promise<void> => {
    const { triggerId } = params

    return window.usageApi.clearTriggerRunLogs({
      triggerId,
    })
  },
  getSchedulingInfo: (): Promise<SchedulingInfo> => {
    return window.usageApi.getSchedulingInfo()
  },
  getTriggerRunLogs: (params: { triggerId: string }): Promise<ScheduleTriggerRunLogEntry[]> => {
    const { triggerId } = params

    return window.usageApi.getTriggerRunLogs({
      triggerId,
    })
  },
  inspectTriggerRegistrations: (): Promise<ScheduleTriggerRegistrationHealth[]> => {
    return window.usageApi.inspectTriggerRegistrations()
  },
  setSchedulingEnabled: (params: { isEnabled: boolean }): Promise<AppSettings> => {
    const { isEnabled } = params

    return window.usageApi.setSchedulingEnabled({
      isEnabled,
    })
  },
  setTriggerEnabled: (params: { isEnabled: boolean; triggerId: string }): Promise<AppSettings> => {
    const { isEnabled, triggerId } = params

    return window.usageApi.setTriggerEnabled({
      isEnabled,
      triggerId,
    })
  },
}
