import { spawn } from 'node:child_process'
import { homedir } from 'node:os'

import { errorUtil } from '#src/main/util/error-util'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'
import { constant } from '#src/shared/util/constant'

const DEFAULT_GRACE_PERIOD_MS = 5000

export type TriggerCommandResult = {
  durationMs: number
  exitCode: number
  isTimedOut: boolean
  output: string
}

export class TriggerCommandService {
  protected readonly _gracePeriodMs: number
  protected readonly _maxOutputLength: number
  protected readonly _spawnImpl: typeof spawn

  constructor(
    params: { gracePeriodMs: number; maxOutputLength: number; spawnImpl: typeof spawn } = {
      gracePeriodMs: DEFAULT_GRACE_PERIOD_MS,
      maxOutputLength: constant.scheduleTrigger.run.log.snippetMaxLength,
      spawnImpl: spawn,
    },
  ) {
    const { gracePeriodMs, maxOutputLength, spawnImpl } = params
    this._gracePeriodMs = gracePeriodMs
    this._maxOutputLength = maxOutputLength
    this._spawnImpl = spawnImpl
  }

  run(params: { command: string; timeoutMs: number }): Promise<TriggerCommandResult> {
    const { command, timeoutMs } = params

    return new Promise<TriggerCommandResult>((resolve) => {
      const startedAt = Date.now()
      const stdoutChunks: string[] = []
      const stderrChunks: string[] = []
      const workerState = { isTimedOut: false }
      const child = this._spawnImpl(this._resolveShellPath(), ['-l', '-c', command], {
        cwd: homedir(),
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const graceTimerRef: { current: ReturnType<typeof setTimeout> | undefined } = { current: undefined }
      const timeoutTimer = setTimeout(() => {
        workerState.isTimedOut = true
        this._killProcessGroup({ pid: child.pid, signal: 'SIGTERM' })
        graceTimerRef.current = setTimeout(() => {
          this._killProcessGroup({ pid: child.pid, signal: 'SIGKILL' })
        }, this._gracePeriodMs)
      }, timeoutMs)
      const clearTimers = (): void => {
        clearTimeout(timeoutTimer)

        if (graceTimerRef.current !== undefined) {
          clearTimeout(graceTimerRef.current)
        }
      }

      child.on('error', (error) => {
        clearTimers()
        resolve({
          durationMs: Date.now() - startedAt,
          exitCode: 1,
          isTimedOut: false,
          output: this._truncate({ value: `failed to start command: ${errorUtil.resolveMessage(error)}` }),
        })
      })

      child.on('close', (code) => {
        clearTimers()
        resolve({
          durationMs: Date.now() - startedAt,
          exitCode: this._resolveExitCode({ code, isTimedOut: workerState.isTimedOut }),
          isTimedOut: workerState.isTimedOut,
          output: this._resolveOutput({ stderrChunks, stdoutChunks }),
        })
      })

      child.stdout.on('data', (chunk: Buffer) => {
        this._captureChunk({ chunk, chunks: stdoutChunks })
      })

      child.stderr.on('data', (chunk: Buffer) => {
        this._captureChunk({ chunk, chunks: stderrChunks })
      })
    })
  }

  protected _captureChunk(params: { chunk: Buffer; chunks: string[] }): void {
    const { chunk, chunks } = params
    const capturedLength = chunks.reduce((total, chunk) => {
      return total + chunk.length
    }, 0)

    if (capturedLength >= this._maxOutputLength) {
      return
    }

    const remainingLength = this._maxOutputLength - capturedLength
    chunks.push(chunk.toString('utf8').slice(0, remainingLength))
  }

  protected _killProcessGroup(params: { pid: number | undefined; signal: NodeJS.Signals }): void {
    const { pid, signal } = params
    if (pid === undefined) {
      return
    }

    try {
      process.kill(-pid, signal)
    } catch {
      return
    }
  }

  protected _resolveExitCode(params: { code: number | null; isTimedOut: boolean }): number {
    const { code, isTimedOut } = params
    if (isTimedOut) {
      return constant.scheduleTrigger.run.exitCodeTimedOut
    }

    if (code !== null) {
      return code
    }

    return 1
  }

  protected _resolveOutput(params: { stderrChunks: string[]; stdoutChunks: string[] }): string {
    const { stderrChunks, stdoutChunks } = params
    const stdout = stdoutChunks.join('')
    const stderr = stderrChunks.join('')

    return this._truncate({ value: `${stdout}\n${stderr}`.trim() })
  }

  protected _resolveShellPath(): string {
    if (osUtil.resolvePlatform() === OS.MACOS) {
      return '/bin/zsh'
    }

    return '/bin/sh'
  }

  protected _truncate(params: { value: string }): string {
    const { value } = params
    if (value.length <= this._maxOutputLength) {
      return value
    }

    return value.slice(0, this._maxOutputLength)
  }
}
