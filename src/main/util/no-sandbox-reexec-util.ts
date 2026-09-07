import { config } from '#src/main/util/config'

export class NoSandboxReexecUtil {
  protected _isDone: boolean

  constructor() {
    this._isDone = config.noSandboxReexec ?? false
  }

  get isDone(): boolean {
    return this._isDone
  }

  markDone(): void {
    this._isDone = true
  }
}
