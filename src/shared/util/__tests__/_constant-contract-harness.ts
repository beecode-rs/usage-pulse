import { constant } from '#src/shared/util/constant'

export const constantContractHarness = {
  isTwentyFourHourTime: (params: { time: string }) => {
    return constant.twentyFourHourTimeRegex.test(params.time)
  },
}
