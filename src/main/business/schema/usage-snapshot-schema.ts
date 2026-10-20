import { z } from 'zod'

import { type UsageWindow } from '#src/shared/business/model/usage-model'
import { constant } from '#src/shared/util/constant'

const providerCatalogIds = constant.providerCatalog.map((entry) => {
  return entry.id
})

const usageWindowSchema = z.object({
  label: z.string().min(1),
  resetAt: z.number().optional().catch(undefined),
  totalAmount: z.number().optional().catch(undefined),
  usedAmount: z.number().optional().catch(undefined),
  usedPercent: z.number(),
  windowMs: z.number().optional().catch(undefined),
})

const usageWindowsSchema = z.array(z.unknown()).transform((rawUsage) => {
  return rawUsage.reduce<UsageWindow[]>((usageWindows, rawWindow) => {
    const parsedWindow = usageWindowSchema.safeParse(rawWindow)

    if (parsedWindow.success) {
      return [...usageWindows, parsedWindow.data]
    }

    return usageWindows
  }, [])
})

export const providerSnapshotEntrySchema = z
  .object({
    fetchedAt: z.number(),
    providerId: z.enum(providerCatalogIds),
    trackerId: z.string().min(1),
    trackerName: z.unknown().optional(),
    usage: usageWindowsSchema,
  })
  .refine((snapshot) => {
    return snapshot.usage.length > 0
  })
