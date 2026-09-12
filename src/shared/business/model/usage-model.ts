import type { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import type { UsageActivityStatus } from '#src/shared/business/enum/usage-activity-status-enum'
import type { AppSettings } from '#src/shared/business/model/settings-model'

export type UsageWindow = {
  label: string
  resetAt?: number
  totalAmount?: number
  usedAmount?: number
  usedPercent: number
  windowMs?: number
}

export type ProviderSnapshot = {
  errorMessage?: string
  fetchedAt?: number
  nextRefreshAt?: number
  providerId: ProviderIdMapper
  status: UsageActivityStatus
  trackerId: string
  trackerName: string
  usage?: UsageWindow[]
}

export type UsageSnapshot = {
  providers: ProviderSnapshot[]
}

export type UsageUpdateListener = (snapshot: UsageSnapshot) => void

export type SettingsUpdateListener = (settings: AppSettings) => void
