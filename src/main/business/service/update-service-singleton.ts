import { singletonPattern } from '@beecode/msh-util'
import { app, shell } from 'electron'
import { createWriteStream } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { appEventBusSingleton } from '#src/main/lib/app-event-bus-singleton'
import { constant } from '#src/main/util/constant'
import { errorUtil } from '#src/main/util/error-util'
import { objectUtil } from '#src/main/util/object-util'
import { osUtil } from '#src/main/util/os-util'
import { updateAssetUtil } from '#src/main/util/update-asset-util'
import { updateCheckErrorUtil } from '#src/main/util/update-check-error-util'
import { VersionCompareUtil } from '#src/main/util/version-compare-util'
import { type UpdateAsset, type UpdateStatus } from '#src/shared/business/model/update-model'
import { updateCheckErrorMessageUtil } from '#src/shared/util/update-check-error-message-util'

type LatestRelease = {
  assets: UpdateAsset[]
  htmlUrl: string
  tagName: string
}

export class _UpdateService {
  protected _isDownloading = false
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
    } catch (error) {
      return this._resolveFailureStatus({ error })
    }
  }

  async downloadUpdate(): Promise<string> {
    if (this._isDownloading) {
      throw new Error('update download is already in progress')
    }

    await this.checkForUpdate()

    const asset = this._status.asset

    if (!this._status.isUpdateAvailable || asset === undefined) {
      throw new Error(this._resolveDownloadBlockerMessage())
    }

    this._isDownloading = true

    try {
      return await this._downloadAsset({ asset })
    } finally {
      this._isDownloading = false
    }
  }

  protected _resolveFailureStatus(params: { error: unknown }): UpdateStatus {
    const { error } = params
    const checkError = updateCheckErrorUtil.classifyThrown({ error })

    // eslint-disable-next-line no-console -- repo has no logger util yet
    console.warn(`update check failed (${checkError.kind}): ${errorUtil.resolveMessage(error)}`)

    const nextStatus = { ...this._status, error: checkError }

    this._status = nextStatus
    appEventBusSingleton().emit({ payload: nextStatus, type: AppEventType.UPDATE_STATUS })

    return nextStatus
  }

  protected _resolveDownloadBlockerMessage(): string {
    const checkError = this._status.error

    if (checkError !== undefined) {
      return updateCheckErrorMessageUtil.resolveMessage({ error: checkError })
    }

    return 'no matching update asset for this platform'
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
      asset: updateAssetUtil.resolveUpdateAsset({
        assets: latestRelease.assets,
        platform: osUtil.resolvePlatform(),
      }),
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
      throw updateCheckErrorUtil.createThrown({
        checkError: updateCheckErrorUtil.classifyResponse({
          rateLimitRemaining: response.headers.get('x-ratelimit-remaining') ?? '',
          rateLimitReset: response.headers.get('x-ratelimit-reset') ?? '',
          status: response.status,
        }),
        message: `github release request failed with status ${String(response.status)}`,
      })
    }

    const rawJson: unknown = await response.json().catch((error: unknown) => {
      throw updateCheckErrorUtil.createThrown({
        checkError: updateCheckErrorUtil.resolveInvalidResponse(),
        message: `github release response is not valid json: ${errorUtil.resolveMessage(error)}`,
      })
    })
    const rawRelease = objectUtil.asRecord(rawJson)

    if (rawRelease === undefined) {
      throw updateCheckErrorUtil.createThrown({
        checkError: updateCheckErrorUtil.resolveInvalidResponse(),
        message: 'github release response is not an object',
      })
    }

    return this._extractLatestRelease({ rawRelease })
  }

  protected _extractLatestRelease(params: { rawRelease: Record<string, unknown> }): LatestRelease {
    const { rawRelease } = params
    const htmlUrl = rawRelease['html_url']
    const tagName = rawRelease['tag_name']

    if (typeof htmlUrl !== 'string' || typeof tagName !== 'string') {
      throw updateCheckErrorUtil.createThrown({
        checkError: updateCheckErrorUtil.resolveInvalidResponse(),
        message: 'github release response is missing html_url or tag_name',
      })
    }

    return {
      assets: this._extractLatestReleaseAssets({ rawAssets: rawRelease['assets'] }),
      htmlUrl,
      tagName,
    }
  }

  protected _extractLatestReleaseAssets(params: { rawAssets: unknown }): UpdateAsset[] {
    const { rawAssets } = params

    if (!Array.isArray(rawAssets)) {
      return []
    }

    return rawAssets.reduce<UpdateAsset[]>((assets, rawAsset) => {
      const asset = this._extractUpdateAsset({ rawAsset })

      if (asset === undefined) {
        return assets
      }

      return [...assets, asset]
    }, [])
  }

  protected _extractUpdateAsset(params: { rawAsset: unknown }): UpdateAsset | undefined {
    const { rawAsset } = params
    const assetRecord = objectUtil.asRecord(rawAsset)
    const name = assetRecord?.['name']
    const url = assetRecord?.['browser_download_url']

    if (assetRecord === undefined || typeof name !== 'string' || typeof url !== 'string') {
      return undefined
    }

    return { name, url }
  }

  protected async _downloadAsset(params: { asset: UpdateAsset }): Promise<string> {
    const { asset } = params
    const filePath = this._resolveDownloadFilePath({ asset })
    const partialFilePath = `${filePath}${constant.updateDownloadPartialFileSuffix}`

    try {
      const response = await fetch(asset.url)

      if (!response.ok) {
        throw new Error(`update asset download failed with status ${String(response.status)}`)
      }

      await pipeline(this._toResponseReadable({ response }), createWriteStream(partialFilePath))
      await rename(partialFilePath, filePath)
      await shell.openPath(filePath)

      return filePath
    } catch (error) {
      await rm(partialFilePath, { force: true }).catch(() => {
        return undefined
      })

      throw error
    }
  }

  protected _resolveDownloadFilePath(params: { asset: UpdateAsset }): string {
    const { asset } = params
    const fileName = basename(asset.name)

    if (fileName === '' || fileName === '.' || fileName === '..') {
      throw new Error('update asset has an invalid file name')
    }

    return join(app.getPath('downloads'), fileName)
  }

  protected _toResponseReadable(params: { response: Response }): Readable {
    const { response } = params

    if (response.body === null) {
      throw new Error('update asset download returned no content')
    }

    return Readable.fromWeb(response.body)
  }
}

export const updateServiceSingleton = singletonPattern(() => {
  return new _UpdateService()
})
