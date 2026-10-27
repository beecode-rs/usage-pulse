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

export type UpdateDebInstallOutcome = 'fallback' | 'failed' | 'installed'

export type UpdateDownloadStatus = 'completed' | 'downloading' | 'error' | 'idle' | 'installing' | 'restart-required'

export type UpdateDownloadProgress = {
  errorMessage?: string
  filePath?: string
  receivedBytes: number
  status: UpdateDownloadStatus
  totalBytes: number
}

export type UpdateDownloadProgressListener = (progress: UpdateDownloadProgress) => void

export type UpdateDownloadResult = {
  filePath: string
  status: UpdateDownloadStatus
}

export type UpdateInstallType = 'appImage' | 'deb' | 'dev' | 'dmg' | 'exe' | 'unsupported'

export type UpdateStatus = {
  asset?: UpdateAsset
  currentVersion: string
  error?: UpdateCheckError
  isUpdateAvailable: boolean
  latestVersion?: string
  releaseUrl?: string
}

export type UpdateStatusListener = (status: UpdateStatus) => void
