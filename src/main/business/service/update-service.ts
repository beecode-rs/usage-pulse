import { objectUtil } from '#src/main/util/object-util'
import { VersionCompareUtil } from '#src/main/util/version-compare-util'
import { type UpdateStatus, type UpdateStatusListener } from '#src/shared/business/model/update-model'

type LatestRelease = {
  htmlUrl: string
  tagName: string
}

export class UpdateService {
  protected _listeners: UpdateStatusListener[] = []
  protected _status: UpdateStatus
  protected readonly _latestReleaseUrl = 'https://api.github.com/repos/beecode-rs/usage-pulse/releases/latest'
  protected readonly _requestTimeoutMs = 10_000

  constructor(params: { currentVersion: string }) {
    this._status = { currentVersion: params.currentVersion, isUpdateAvailable: false }
  }

  getStatus(): UpdateStatus {
    return this._status
  }

  async checkForUpdate(): Promise<UpdateStatus> {
    try {
      const latestRelease = await this._fetchLatestRelease()
      const nextStatus = this._resolveNextStatus({ latestRelease })

      this._status = nextStatus
      this._notifyListeners({ status: nextStatus })

      return nextStatus
    } catch {
      return this._status
    }
  }

  onUpdate(params: { listener: UpdateStatusListener }): () => void {
    this._listeners.push(params.listener)

    return () => {
      this._listeners = this._listeners.filter((listener) => {
        return listener !== params.listener
      })
    }
  }

  protected _resolveNextStatus(params: { latestRelease: LatestRelease }): UpdateStatus {
    const currentVersion = this._status.currentVersion
    const isUpdateAvailable = new VersionCompareUtil().isNewerVersion({
      candidateVersion: params.latestRelease.tagName,
      currentVersion,
    })

    if (!isUpdateAvailable) {
      return { currentVersion, isUpdateAvailable: false }
    }

    return {
      currentVersion,
      isUpdateAvailable: true,
      latestVersion: this._resolveDisplayVersion({ tagName: params.latestRelease.tagName }),
      releaseUrl: params.latestRelease.htmlUrl,
    }
  }

  protected _resolveDisplayVersion(params: { tagName: string }): string {
    const trimmedTagName = params.tagName.trim()

    if (trimmedTagName.startsWith('v') || trimmedTagName.startsWith('V')) {
      return trimmedTagName.slice(1)
    }

    return trimmedTagName
  }

  protected async _fetchLatestRelease(): Promise<LatestRelease> {
    const response = await fetch(this._latestReleaseUrl, {
      headers: { accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(this._requestTimeoutMs),
    })

    if (!response.ok) {
      throw new Error(`github release request failed with status ${String(response.status)}`)
    }

    const rawJson: unknown = await response.json()
    const rawRelease = objectUtil.asRecord(rawJson)

    if (rawRelease === undefined) {
      throw new Error('github release response is not an object')
    }

    return this._extractLatestRelease({ rawRelease })
  }

  protected _extractLatestRelease(params: { rawRelease: Record<string, unknown> }): LatestRelease {
    const htmlUrl = params.rawRelease['html_url']
    const tagName = params.rawRelease['tag_name']

    if (typeof htmlUrl !== 'string' || typeof tagName !== 'string') {
      throw new Error('github release response is missing html_url or tag_name')
    }

    return { htmlUrl, tagName }
  }

  protected _notifyListeners(params: { status: UpdateStatus }): void {
    this._listeners.forEach((listener) => {
      listener(params.status)
    })
  }
}
