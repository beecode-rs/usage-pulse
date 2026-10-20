import { app } from 'electron'

import { config } from '#src/main/util/config'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'

export class NoSandboxReexecUtil {
  protected _isDone: boolean

  constructor() {
    this._isDone = config.noSandboxReexec ?? false
  }

  get isDone(): boolean {
    return this._isDone
  }

  isRequired(): boolean {
    return (
      osUtil.resolvePlatform() === OS.LINUX && app.isPackaged && !process.argv.includes('--no-sandbox') && !this.isDone
    )
  }

  markDone(): void {
    this._isDone = true
  }

  reexec(): void {
    this.markDone()
    app.relaunch({ args: [...process.argv.slice(1), '--no-sandbox'] })
    app.exit(0)
  }
}
