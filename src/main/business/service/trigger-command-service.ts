import { spawn } from 'node:child_process'
import { homedir } from 'node:os'

import { constant } from '#src/main/util/constant'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'
import { constant as sharedConstant } from '#src/shared/util/constant'
import { errorUtil } from '#src/shared/util/error-util'

export type TriggerCommandResult = {
  durationMs: number
  exitCode: number
  isTimedOut: boolean
  output: string
}

export class TriggerCommandService {
  protected readonly _gracePeriodMs: number
  protected readonly _maxOutputLength: number

  constructor(
    params: { gracePeriodMs: number; maxOutputLength: number } = {
      gracePeriodMs: constant.scheduleTrigger.gracePeriodMs,
      maxOutputLength: sharedConstant.scheduleTrigger.run.log.snippetMaxLength,
    },
  ) {
    const { gracePeriodMs, maxOutputLength } = params
    this._gracePeriodMs = gracePeriodMs
    this._maxOutputLength = maxOutputLength
  }

  run(params: { command: string; timeoutMs: number }): Promise<TriggerCommandResult> {
    const { command, timeoutMs } = params

    return new Promise<TriggerCommandResult>((resolve) => {
      const startedAt = Date.now()
      const stdoutChunks: string[] = []
      const stderrChunks: string[] = []
      const workerState = { isTimedOut: false }
      const child = spawn(this._resolveShellPath(), ['-l', '-c', command], {
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
        const capturedChunk = this._captureChunk({ capturedChunks: stdoutChunks, chunk })

        if (capturedChunk !== '') {
          stdoutChunks.push(capturedChunk)
        }
      })

      child.stderr.on('data', (chunk: Buffer) => {
        const capturedChunk = this._captureChunk({ capturedChunks: stderrChunks, chunk })

        if (capturedChunk !== '') {
          stderrChunks.push(capturedChunk)
        }
      })
    })
  }

  protected _captureChunk(params: { capturedChunks: string[]; chunk: Buffer }): string {
    const { capturedChunks, chunk } = params
    const capturedLength = capturedChunks.reduce((total, capturedChunk) => {
      return total + capturedChunk.length
    }, 0)

    if (capturedLength >= this._maxOutputLength) {
      return ''
    }

    return chunk.toString('utf8').slice(0, this._maxOutputLength - capturedLength)
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
      return sharedConstant.scheduleTrigger.run.exitCodeTimedOut
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
