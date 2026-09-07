import { constant } from '#src/shared/util/constant'

export const constantContractHarness = {
  isTwentyFourHourTime: (params: { time: string }) => {
    const { time } = params

    return constant.twentyFourHourTimeRegex.test(time)
  },
}
