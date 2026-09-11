import { SchedulingStrategyLinux } from '#src/main/business/component/scheduling-strategy/linux'
import { SchedulingStrategyMacLaunchd } from '#src/main/business/component/scheduling-strategy/mac-launchd'
import { type SchedulingStrategy } from '#src/main/business/component/scheduling-strategy/scheduling-strategy'
import { SchedulingStrategyWindows } from '#src/main/business/component/scheduling-strategy/windows'
import { osUtil } from '#src/main/util/os-util'
import { OS } from '#src/shared/business/enum/os-enum'

export class SchedulingStrategyFactory {
  resolve(params: { platform?: OS } = {}): SchedulingStrategy {
    const platform = params.platform ?? osUtil.resolvePlatform()

    return this._resolveForPlatform({ platform })
  }

  protected _resolveForPlatform(params: { platform: OS }): SchedulingStrategy {
    switch (params.platform) {
      case OS.LINUX: {
        return new SchedulingStrategyLinux()
      }

      case OS.MACOS: {
        return new SchedulingStrategyMacLaunchd()
      }

      case OS.WINDOWS: {
        return new SchedulingStrategyWindows()
      }

      default: {
        throw new Error('Scheduling is not supported on the resolved platform')
      }
    }
  }
}
