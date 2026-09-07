export const idUtil = {
  ensureUniqueIds: <T extends { id: string }>(items: T[]): T[] => {
    const seenIds = new Set<string>()

    return items.map((item) => {
      if (seenIds.has(item.id)) {
        return { ...item, id: crypto.randomUUID() }
      }

      seenIds.add(item.id)

      return item
    })
  },
}
