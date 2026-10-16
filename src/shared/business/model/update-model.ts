import { type UpdateCheckErrorKind } from '#src/shared/business/enum/update-check-error-kind-enum'

export type UpdateCheckError = {
  httpStatusCode?: number
  kind: UpdateCheckErrorKind
  rateLimitResetAt?: number
}

export type UpdateAsset = {
  name: string
  url: string
}

export type UpdateStatus = {
  asset?: UpdateAsset
  currentVersion: string
  error?: UpdateCheckError
  isUpdateAvailable: boolean
  latestVersion?: string
  releaseUrl?: string
}

export type UpdateStatusListener = (status: UpdateStatus) => void
