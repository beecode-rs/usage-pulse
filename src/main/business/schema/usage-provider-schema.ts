import { z } from 'zod'

import { percentUtil } from '#src/main/util/percent-util'

export const clampedPercentSchema = z
  .number()
  .transform((value) => {
    return percentUtil.roundPercentToOneDecimal(percentUtil.clampPercent(value))
  })
  .optional()
  .catch(undefined)
