import { spawn } from 'node:child_process'
import { homedir } from 'node:os'

import { errorUtil } from '#src/main/util/error-util'
import { OS, osUtil } from '#src/main/util/os-util'
import { TRIGGER_RUN_EXIT_CODE_TIMED_OUT, TRIGGER_RUN_LOG_SNIPPET_MAX_LENGTH } from '#src/shared/trigger-model'

const DEFAULT_GRACE_PERIOD_MS = 5000

export interface ITriggerCommandResult {
  durationMs: number
  exitCode: number
  isTimedOut: boolean
  output: string
}

export class TriggerCommandService {
  protected readonly _gracePeriodMs: number
  protected readonly _maxOutputLength: number
  protected readonly _spawnImpl: typeof spawn

  constructor(params: { gracePeriodMs?: number; maxOutputLength?: number; spawnImpl?: typeof spawn } = {}) {
    this._gracePeriodMs = params.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS
    this._maxOutputLength = params.maxOutputLength ?? TRIGGER_RUN_LOG_SNIPPET_MAX_LENGTH
    this._spawnImpl = params.spawnImpl ?? spawn
  }

  run(params: { command: string; timeoutMs: number }): Promise<ITriggerCommandResult> {
    return new Promise<ITriggerCommandResult>((resolve) => {
      const startedAt = Date.now()
      const stdoutChunks: string[] = []
      const stderrChunks: string[] = []
      const workerState = { isTimedOut: false }
      const child = this._spawnImpl(this._resolveShellPath(), ['-l', '-c', params.command], {
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
      }, params.timeoutMs)
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
    const capturedLength = params.chunks.reduce((total, chunk) => {
      return total + chunk.length
    }, 0)

    if (capturedLength >= this._maxOutputLength) {
      return
    }

    const remainingLength = this._maxOutputLength - capturedLength
    params.chunks.push(params.chunk.toString('utf8').slice(0, remainingLength))
  }

  protected _killProcessGroup(params: { pid: number | undefined; signal: NodeJS.Signals }): void {
    if (params.pid === undefined) {
      return
    }

    try {
      process.kill(-params.pid, params.signal)
    } catch {
      return
    }
  }

  protected _resolveExitCode(params: { code: number | null; isTimedOut: boolean }): number {
    if (params.isTimedOut) {
      return TRIGGER_RUN_EXIT_CODE_TIMED_OUT
    }

    if (params.code !== null) {
      return params.code
    }

    return 1
  }

  protected _resolveOutput(params: { stderrChunks: string[]; stdoutChunks: string[] }): string {
    const stdout = params.stdoutChunks.join('')
    const stderr = params.stderrChunks.join('')

    return this._truncate({ value: `${stdout}\n${stderr}`.trim() })
  }

  protected _resolveShellPath(): string {
    if (osUtil.resolvePlatform() === OS.MACOS) {
      return '/bin/zsh'
    }

    return '/bin/sh'
  }

  protected _truncate(params: { value: string }): string {
    if (params.value.length <= this._maxOutputLength) {
      return params.value
    }

    return params.value.slice(0, this._maxOutputLength)
  }
}
