import { constant } from '#src/main/util/constant'

export const constantContractHarness = {
  execAppBundleRegex: (params: { comm: string }) => {
    const { comm } = params

    return constant.appBundleRegex.exec(comm)
  },
  execProcessLineRegex: (params: { line: string }) => {
    const { line } = params

    return constant.processLineRegex.exec(line)
  },
  execTwoDigitTimeRegex: (params: { time: string }) => {
    const { time } = params

    return constant.twoDigitTimeRegex.exec(time)
  },
  isDigitsOnly: (params: { segment: string }) => {
    const { segment } = params

    return constant.digitsOnlyRegex.test(segment)
  },
}
