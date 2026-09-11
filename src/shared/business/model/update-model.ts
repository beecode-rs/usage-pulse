export type UpdateStatus = {
  currentVersion: string
  isUpdateAvailable: boolean
  latestVersion?: string
  releaseUrl?: string
}

export type UpdateStatusListener = (status: UpdateStatus) => void
