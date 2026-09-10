import { constant } from '#src/main/util/constant'

export const constantContractHarness = {
  execAppBundleRegex: (params: { comm: string }) => {
    return constant.appBundleRegex.exec(params.comm)
  },
  execProcessLineRegex: (params: { line: string }) => {
    return constant.processLineRegex.exec(params.line)
  },
  execTwoDigitTimeRegex: (params: { time: string }) => {
    return constant.twoDigitTimeRegex.exec(params.time)
  },
  isDigitsOnly: (params: { segment: string }) => {
    return constant.digitsOnlyRegex.test(params.segment)
  },
}
