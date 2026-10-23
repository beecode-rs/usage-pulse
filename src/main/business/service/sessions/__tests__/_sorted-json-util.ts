// Deterministic JSON projection for contract harnesses: the msh-test-contractor
// result matcher serializes results with JSON.stringify and a top-level key
// filter (an array replacer), which strips every nested object's content and
// leaves depth-2 values comparing as opaque {} shapes. Projecting a payload
// through this key-sorted stringify turns it into a plain string the runner
// compares fully, so contract terms can assert nested payload content.

const resolveSortedValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => {
      return resolveSortedValue(item)
    })
  }

  if (value === null || typeof value !== 'object') {
    return value
  }

  const record = value as Record<string, unknown>

  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      return { ...acc, [key]: resolveSortedValue(record[key]) }
    }, {})
}

export const sortedJsonUtil = {
  stringify: (params: { value: unknown }): string => {
    const { value } = params

    return JSON.stringify(resolveSortedValue(value))
  },
}
