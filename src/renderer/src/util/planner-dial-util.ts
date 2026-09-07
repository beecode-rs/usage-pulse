import { constant } from '#src/renderer/src/util/constant'

export class PlannerDialUtil {
  resolveDialDeltaDegrees(params: { angleDegrees: number }): number {
    const { angleDegrees } = params
    const deltaDegrees = (((angleDegrees - constant.plannerDialStartAngleDegrees) % 360) + 360) % 360

    if (deltaDegrees <= constant.plannerDialAngleRangeDegrees) {
      return deltaDegrees
    }

    if (deltaDegrees - constant.plannerDialAngleRangeDegrees < 360 - deltaDegrees) {
      return constant.plannerDialAngleRangeDegrees
    }

    return 0
  }

  resolveKeyboardValue(params: { key: string; max: number; min: number; step: number; value: number }): number {
    const { key, max, min, step, value } = params
    switch (key) {
      case 'ArrowDown':
      case 'ArrowLeft': {
        return this._resolveClampedValue({
          max,
          min,
          value: value - step,
        })
      }

      case 'ArrowRight':
      case 'ArrowUp': {
        return this._resolveClampedValue({
          max,
          min,
          value: value + step,
        })
      }

      case 'End': {
        return max
      }

      case 'Home': {
        return min
      }

      default: {
        return value
      }
    }
  }

  resolvePointerValue(params: { dx: number; dy: number; max: number; min: number; step: number }): number {
    const { dx, dy, max, min, step } = params
    const pointerAngleDegrees = (Math.atan2(dy, dx) * 180) / Math.PI
    const deltaDegrees = this.resolveDialDeltaDegrees({ angleDegrees: pointerAngleDegrees })
    const valueFraction = deltaDegrees / constant.plannerDialAngleRangeDegrees
    const rawValue = min + valueFraction * (max - min)

    return this.resolveSteppedValue({ max, min, rawValue, step })
  }

  resolveSteppedValue(params: { max: number; min: number; rawValue: number; step: number }): number {
    const { max, min, rawValue, step } = params
    const stepCount = Math.round((rawValue - min) / step)
    const steppedValue = min + stepCount * step

    return this._resolveClampedValue({ max, min, value: steppedValue })
  }

  resolveValueAngleDegrees(params: { max: number; min: number; value: number }): number {
    const { max, min, value } = params
    const valueFraction = (value - min) / (max - min)

    return constant.plannerDialStartAngleDegrees + valueFraction * constant.plannerDialAngleRangeDegrees
  }

  protected _resolveClampedValue(params: { max: number; min: number; value: number }): number {
    const { max, min, value } = params

    return Math.min(Math.max(value, min), max)
  }
}
