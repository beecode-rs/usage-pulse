import { type ScheduleTriggerConfig } from '#src/shared/business/model/schedule-trigger-model'
import { constant } from '#src/shared/util/constant'

export const triggerValidationUtil = {
  resolveValidationError(params: { trigger: ScheduleTriggerConfig }): string | undefined {
    if (params.trigger.command.trim() === '') {
      return 'Enter a command for this trigger to run.'
    }

    if (params.trigger.days.length === 0) {
      return 'Pick at least one day for this trigger.'
    }

    const filledTimes = params.trigger.times.filter((time) => {
      return time !== ''
    })

    if (filledTimes.length === 0) {
      return 'Add at least one time for this trigger.'
    }

    const hasInvalidTime = filledTimes.some((time) => {
      return !constant.twentyFourHourTimeRegex.test(time)
    })

    if (hasInvalidTime) {
      return 'Every time must use the HH:mm format.'
    }

    return undefined
  },
}
