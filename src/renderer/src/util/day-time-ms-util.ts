export const dayTimeMsUtil = {
  resolveDayMs: (time: string): number => {
    const hours = Number.parseInt(time.slice(0, 2), 10)
    const minutes = Number.parseInt(time.slice(3, 5), 10)

    return hours * 3_600_000 + minutes * 60_000
  },
}
