import { singletonPattern } from '@beecode/msh-util'
import { app } from 'electron'

import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { appEventBusSingleton } from '#src/main/business/service/app-event-bus-singleton'
import { objectUtil } from '#src/main/util/object-util'
import { VersionCompareUtil } from '#src/main/util/version-compare-util'
import { type UpdateStatus } from '#src/shared/business/model/update-model'

type LatestRelease = {
  htmlUrl: string
  tagName: string
}

export class _UpdateService {
  protected _status: UpdateStatus = { currentVersion: app.getVersion(), isUpdateAvailable: false }
  protected readonly _latestReleaseUrl = 'https://api.github.com/repos/beecode-rs/usage-pulse/releases/latest'
  protected readonly _requestTimeoutMs = 10_000

  getStatus(): UpdateStatus {
    return this._status
  }

  async checkForUpdate(): Promise<UpdateStatus> {
    try {
      const latestRelease = await this._fetchLatestRelease()
      const nextStatus = this._resolveNextStatus({ latestRelease })

      this._status = nextStatus
      appEventBusSingleton().emit({ payload: nextStatus, type: AppEventType.UPDATE_STATUS })

      return nextStatus
    } catch {
      return this._status
    }
  }

  protected _resolveNextStatus(params: { latestRelease: LatestRelease }): UpdateStatus {
    const { latestRelease } = params
    const currentVersion = this._status.currentVersion
    const isUpdateAvailable = new VersionCompareUtil().isNewerVersion({
      candidateVersion: latestRelease.tagName,
      currentVersion,
    })

    if (!isUpdateAvailable) {
      return { currentVersion, isUpdateAvailable: false }
    }

    return {
      currentVersion,
      isUpdateAvailable: true,
      latestVersion: this._resolveDisplayVersion({ tagName: latestRelease.tagName }),
      releaseUrl: latestRelease.htmlUrl,
    }
  }

  protected _resolveDisplayVersion(params: { tagName: string }): string {
    const { tagName } = params
    const trimmedTagName = tagName.trim()

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
    const { rawRelease } = params
    const htmlUrl = rawRelease['html_url']
    const tagName = rawRelease['tag_name']

    if (typeof htmlUrl !== 'string' || typeof tagName !== 'string') {
      throw new Error('github release response is missing html_url or tag_name')
    }

    return { htmlUrl, tagName }
  }
}

export const updateServiceSingleton = singletonPattern(() => {
  return new _UpdateService()
})
