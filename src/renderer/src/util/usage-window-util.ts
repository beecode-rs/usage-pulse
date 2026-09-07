export const usageWindowUtil = {
  resolveValueText: (params: {
    totalAmount?: number
    usedAmount?: number
    usedPercent: number
  }): string | undefined => {
    const { totalAmount, usedAmount, usedPercent } = params
    if (usedAmount === undefined || totalAmount === undefined) {
      return undefined
    }

    return `${String(Math.round(usedPercent))}% · ${String(usedAmount)} / ${String(totalAmount)}`
  },
}
