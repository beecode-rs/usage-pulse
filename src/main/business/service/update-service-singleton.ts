import { singletonPattern } from '@beecode/msh-util'
import { app, shell } from 'electron'
import { spawn } from 'node:child_process'
import { constants, createWriteStream } from 'node:fs'
import { access, chmod, rename, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { AppEventType } from '#src/main/business/enum/app-event-type-enum'
import { appEventBusSingleton } from '#src/main/business/service/app-event-bus-singleton'
import { updateAssetService } from '#src/main/business/service/update-asset-service'
import { updateCheckErrorService } from '#src/main/business/service/update-check-error-service'
import { constant } from '#src/main/util/constant'
import { objectUtil } from '#src/main/util/object-util'
import { osUtil } from '#src/main/util/os-util'
import { VersionCompareUtil } from '#src/main/util/version-compare-util'
import {
  type UpdateAsset,
  type UpdateDownloadProgress,
  type UpdateDownloadResult,
  type UpdateInstallType,
  type UpdateStatus,
} from '#src/shared/business/model/update-model'
import { updateCheckErrorMessageService } from '#src/shared/business/service/update-check-error-message-service'
import { errorUtil } from '#src/shared/util/error-util'

type LatestRelease = {
  assets: UpdateAsset[]
  htmlUrl: string
  tagName: string
}

export class _UpdateService {
  protected _downloadProgress: UpdateDownloadProgress = {
    receivedBytes: 0,
    status: 'idle',
    totalBytes: 0,
  }

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

  async downloadUpdate(): Promise<UpdateDownloadResult> {
    const busyMessage = this._resolveBusyMessage()

    if (busyMessage !== null) {
      throw new Error(busyMessage)
    }

    await this.checkForUpdate()

    const asset = this._status.asset

    if (!this._status.isUpdateAvailable || asset === undefined) {
      throw new Error(this._resolveDownloadBlockerMessage())
    }

    return await this._downloadAsset({ asset })
  }

  openRelease(): void {
    const releaseUrl = this._status.releaseUrl

    if (!releaseUrl?.startsWith('https://github.com/')) {
      return
    }

    void shell.openExternal(releaseUrl)
  }

  relaunchForUpdate(): void {
    const appImagePath = this._resolveAppImagePath()

    if (appImagePath !== null) {
      app.relaunch({ execPath: appImagePath })
      app.exit(0)

      return
    }

    app.relaunch()
    app.exit(0)
  }

  protected _addReceivedBytes(params: { bytes: number }): void {
    const { bytes } = params

    this._setDownloadProgress({ receivedBytes: this._downloadProgress.receivedBytes + bytes })
  }

  protected async _downloadAsset(params: { asset: UpdateAsset }): Promise<UpdateDownloadResult> {
    const { asset } = params
    const appImagePath = await this._resolveSelfUpdatableAppImagePath()
    const filePath = this._resolveDownloadTargetFilePath({ appImagePath, asset })
    const partialFilePath = `${filePath}${constant.update.downloadPartialFileSuffix}`

    this._setDownloadProgress({ filePath, receivedBytes: 0, status: 'downloading', totalBytes: 0 })

    try {
      const response = await fetch(asset.url)

      if (!response.ok) {
        throw new Error(`update asset download failed with status ${String(response.status)}`)
      }

      this._setDownloadProgress({ totalBytes: this._resolveContentLength({ response }) })

      await pipeline(this._toResponseReadable({ response }), createWriteStream(partialFilePath))
      await rename(partialFilePath, filePath)
      await this._installDownloadedUpdate({ appImagePath, filePath, installType: this._resolveInstallType() })

      return { filePath, status: this._downloadProgress.status }
    } catch (error) {
      await rm(partialFilePath, { force: true }).catch(() => {
        return undefined
      })

      this._setDownloadProgress({ errorMessage: errorUtil.resolveMessage(error), status: 'error' })

      throw error
    }
  }

  protected _setDownloadProgress(progress: Partial<UpdateDownloadProgress>): void {
    this._downloadProgress = { ...this._downloadProgress, ...progress }
    appEventBusSingleton().emit({ payload: { ...this._downloadProgress }, type: AppEventType.UPDATE_DOWNLOAD_STATUS })
  }

  protected async _installAppImageUpdate(params: { filePath: string }): Promise<void> {
    const { filePath } = params

    this._setDownloadProgress({ status: 'installing' })
    await chmod(filePath, 0o755)
    this._setDownloadProgress({ status: 'restart-required' })
  }

  protected async _installDebUpdate(params: { filePath: string }): Promise<void> {
    const { filePath } = params

    this._setDownloadProgress({ status: 'installing' })

    const installResult = await this._resolveDebInstallResult({ filePath })
    const outcome = updateAssetService.resolveDebInstallOutcome({
      exitCode: installResult.exitCode,
      isSpawnFailed: installResult.isSpawnFailed,
    })

    if (outcome === 'installed') {
      this._setDownloadProgress({ status: 'restart-required' })

      return
    }

    if (outcome === 'fallback') {
      await shell.openPath(filePath)
      this._setDownloadProgress({ status: 'completed' })

      return
    }

    throw new Error(`update install failed (dpkg exit ${String(installResult.exitCode)}): ${installResult.stderrTail}`)
  }

  protected async _installDownloadedUpdate(params: {
    appImagePath: string | null
    filePath: string
    installType: UpdateInstallType
  }): Promise<void> {
    const { appImagePath, filePath, installType } = params

    if (installType === 'deb') {
      await this._installDebUpdate({ filePath })

      return
    }

    if (appImagePath !== null) {
      await this._installAppImageUpdate({ filePath })

      return
    }

    await shell.openPath(filePath)
    this._setDownloadProgress({ status: 'completed' })
  }

  protected async _isWritableAppImageDir(params: { appImagePath: string }): Promise<boolean> {
    const { appImagePath } = params

    try {
      await access(dirname(appImagePath), constants.W_OK)

      return true
    } catch {
      return false
    }
  }

  protected _runCommand(params: {
    args: string[]
    command: string
  }): Promise<{ code: number | null; stderrTail: string }> {
    const { args, command } = params

    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      const stderrChunks: Buffer[] = []

      childProcess.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk)
      })

      childProcess.on('error', (error: Error) => {
        reject(error)
      })

      childProcess.on('close', (code: number | null) => {
        const stderrTail = Buffer.concat(stderrChunks)
          .toString('utf8')
          .slice(-constant.update.installStderrTailMaxLength)

        resolve({ code, stderrTail })
      })
    })
  }

  protected _resolveAppImagePath(): string | null {
    return process.env.APPIMAGE ?? null
  }

  protected _resolveBusyMessage(): string | null {
    switch (this._downloadProgress.status) {
      case 'downloading': {
        return 'update download already in progress'
      }

      case 'installing': {
        return 'update install already in progress'
      }

      case 'restart-required': {
        return 'update already installed — restart to finish'
      }

      default: {
        return null
      }
    }
  }

  protected _resolveContentLength(params: { response: Response }): number {
    const { response } = params
    const contentLength = Number.parseInt(response.headers.get('content-length') ?? '', 10)

    if (Number.isNaN(contentLength)) {
      return 0
    }

    return contentLength
  }

  protected async _resolveDebInstallResult(params: {
    filePath: string
  }): Promise<{ exitCode: number | null; isSpawnFailed: boolean; stderrTail: string }> {
    const { filePath } = params

    try {
      const commandResult = await this._runCommand({ args: ['dpkg', '-i', filePath], command: 'pkexec' })

      return {
        exitCode: commandResult.code,
        isSpawnFailed: false,
        stderrTail: commandResult.stderrTail,
      }
    } catch {
      return { exitCode: null, isSpawnFailed: true, stderrTail: '' }
    }
  }

  protected _resolveFailureStatus(params: { error: unknown }): UpdateStatus {
    const { error } = params
    const checkError = updateCheckErrorService.classifyThrown({ error })

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
      return updateCheckErrorMessageService.resolveMessage({ error: checkError })
    }

    return 'no matching update asset for this platform'
  }

  protected _resolveDownloadFilePath(params: { asset: UpdateAsset }): string {
    const { asset } = params
    const fileName = basename(asset.name)

    if (fileName === '' || fileName === '.' || fileName === '..') {
      throw new Error('update asset has an invalid file name')
    }

    return join(app.getPath('downloads'), fileName)
  }

  protected _resolveDownloadTargetFilePath(params: { appImagePath: string | null; asset: UpdateAsset }): string {
    const { appImagePath, asset } = params

    if (appImagePath !== null) {
      return appImagePath
    }

    return this._resolveDownloadFilePath({ asset })
  }

  protected _resolveInstallType(): UpdateInstallType {
    return updateAssetService.resolveInstallType({
      appImagePath: this._resolveAppImagePath(),
      isPackaged: app.isPackaged,
      platform: osUtil.resolvePlatform(),
    })
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
      asset: updateAssetService.resolveUpdateAsset({
        assets: latestRelease.assets,
        installType: this._resolveInstallType(),
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

  protected async _resolveSelfUpdatableAppImagePath(): Promise<string | null> {
    const appImagePath = this._resolveAppImagePath()

    if (appImagePath === null) {
      return null
    }

    const isWritable = await this._isWritableAppImageDir({ appImagePath })

    if (!isWritable) {
      return null
    }

    return appImagePath
  }

  protected async _fetchLatestRelease(): Promise<LatestRelease> {
    const response = await fetch(this._latestReleaseUrl, {
      headers: { accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(this._requestTimeoutMs),
    })

    if (!response.ok) {
      throw updateCheckErrorService.createThrown({
        checkError: updateCheckErrorService.classifyResponse({
          rateLimitRemaining: response.headers.get('x-ratelimit-remaining') ?? '',
          rateLimitReset: response.headers.get('x-ratelimit-reset') ?? '',
          status: response.status,
        }),
        message: `github release request failed with status ${String(response.status)}`,
      })
    }

    const rawJson: unknown = await response.json().catch((error: unknown) => {
      throw updateCheckErrorService.createThrown({
        checkError: updateCheckErrorService.resolveInvalidResponse(),
        message: `github release response is not valid json: ${errorUtil.resolveMessage(error)}`,
      })
    })
    const rawRelease = objectUtil.asRecord(rawJson)

    if (rawRelease === undefined) {
      throw updateCheckErrorService.createThrown({
        checkError: updateCheckErrorService.resolveInvalidResponse(),
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
      throw updateCheckErrorService.createThrown({
        checkError: updateCheckErrorService.resolveInvalidResponse(),
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

  protected _toResponseReadable(params: { response: Response }): Readable {
    const { response } = params

    if (response.body === null) {
      throw new Error('update asset download returned no content')
    }

    const readable = Readable.fromWeb(response.body)

    readable.on('data', (chunk: Buffer) => {
      this._addReceivedBytes({ bytes: chunk.length })
    })

    return readable
  }
}

export const updateServiceSingleton = singletonPattern(() => {
  return new _UpdateService()
})
