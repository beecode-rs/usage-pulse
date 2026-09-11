import type {
  ScheduleTriggerRegistrationHealth,
  ScheduleTriggerRunLogEntry,
  SchedulingInfo,
} from '#src/shared/business/model/schedule-trigger-model'
import type { AppSettings } from '#src/shared/business/model/settings-model'

export const schedulingClientService = {
  clearTriggerRunLogs: (params: { triggerId: string }): Promise<void> => {
    return window.usageApi.clearTriggerRunLogs({
      triggerId: params.triggerId,
    })
  },
  getSchedulingInfo: (): Promise<SchedulingInfo> => {
    return window.usageApi.getSchedulingInfo()
  },
  getTriggerRunLogs: (params: { triggerId: string }): Promise<ScheduleTriggerRunLogEntry[]> => {
    return window.usageApi.getTriggerRunLogs({
      triggerId: params.triggerId,
    })
  },
  inspectTriggerRegistrations: (): Promise<ScheduleTriggerRegistrationHealth[]> => {
    return window.usageApi.inspectTriggerRegistrations()
  },
  setSchedulingEnabled: (params: { isEnabled: boolean }): Promise<AppSettings> => {
    return window.usageApi.setSchedulingEnabled({
      isEnabled: params.isEnabled,
    })
  },
  setTriggerEnabled: (params: { isEnabled: boolean; triggerId: string }): Promise<AppSettings> => {
    return window.usageApi.setTriggerEnabled({
      isEnabled: params.isEnabled,
      triggerId: params.triggerId,
    })
  },
}
