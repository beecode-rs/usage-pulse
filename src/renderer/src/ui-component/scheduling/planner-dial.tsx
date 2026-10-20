import {
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
} from 'react'

import { PlannerDialToneMapper } from '#src/renderer/src/business/enum/planner-dial-tone-mapper-enum'
import { constant } from '#src/renderer/src/util/constant'
import { PlannerDialUtil } from '#src/renderer/src/util/planner-dial-util'

const resolveDialClassName = (tone: PlannerDialToneMapper | undefined): string => {
  if (tone === undefined) {
    return 'planner-dial'
  }

  return `planner-dial is-${tone}`
}

const resolvePointOnCircle = (params: {
  angleDegrees: number
  center: number
  radius: number
}): { x: number; y: number } => {
  const { angleDegrees, center, radius } = params
  const angleRadians = (angleDegrees * Math.PI) / 180

  return {
    x: center + radius * Math.cos(angleRadians),
    y: center + radius * Math.sin(angleRadians),
  }
}

const resolveLargeArcFlag = (sweepDegrees: number): number => {
  if (sweepDegrees > 180) {
    return 1
  }

  return 0
}

const resolveArcPath = (params: {
  center: number
  endAngleDegrees: number
  radius: number
  startAngleDegrees: number
}): string => {
  const { center, endAngleDegrees, radius, startAngleDegrees } = params
  const startPoint = resolvePointOnCircle({
    angleDegrees: startAngleDegrees,
    center,
    radius,
  })
  const endPoint = resolvePointOnCircle({
    angleDegrees: endAngleDegrees,
    center,
    radius,
  })
  const largeArcFlag = resolveLargeArcFlag(endAngleDegrees - startAngleDegrees)

  return [
    `M ${String(startPoint.x)} ${String(startPoint.y)}`,
    `A ${String(radius)} ${String(radius)} 0 ${String(largeArcFlag)} 1 ${String(endPoint.x)} ${String(endPoint.y)}`,
  ].join(' ')
}

export const SchedulingPlannerDial = (props: {
  formatValue: (value: number) => string
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  step: number
  tone?: PlannerDialToneMapper
  value: number
}): ReactElement => {
  const { formatValue, label, max, min, onChange, step, tone, value } = props
  const svgRef = useRef<SVGSVGElement | null>(null)
  const isDraggingRef = useRef(false)
  const plannerDialUtil = new PlannerDialUtil()

  const valueAngleDegrees = plannerDialUtil.resolveValueAngleDegrees({
    max,
    min,
    value,
  })
  const knobPoint = resolvePointOnCircle({
    angleDegrees: valueAngleDegrees,
    center: constant.plannerDial.centerPx,
    radius: constant.plannerDial.radiusPx,
  })

  const publishValue = (nextValue: number): void => {
    if (nextValue === value) {
      return
    }

    onChange(nextValue)
  }

  const publishPointerValue = (event: ReactPointerEvent<SVGSVGElement>): void => {
    const rect = svgRef.current?.getBoundingClientRect()

    if (rect === undefined) {
      return
    }

    publishValue(
      plannerDialUtil.resolvePointerValue({
        dx: event.clientX - (rect.left + rect.width / 2),
        dy: event.clientY - (rect.top + rect.height / 2),
        max,
        min,
        step,
      }),
    )
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>): void => {
    event.preventDefault()
    isDraggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    publishPointerValue(event)
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!isDraggingRef.current) {
      return
    }

    publishPointerValue(event)
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>): void => {
    isDraggingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handlePointerCancel = (): void => {
    isDraggingRef.current = false
  }

  const handleKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>): void => {
    const nextValue = plannerDialUtil.resolveKeyboardValue({
      key: event.key,
      max,
      min,
      step,
      value,
    })

    if (nextValue === value) {
      return
    }

    event.preventDefault()
    onChange(nextValue)
  }

  return (
    <div className={resolveDialClassName(tone)}>
      <span className="planner-dial-label">{label}</span>
      <svg
        aria-label={label}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        aria-valuetext={formatValue(value)}
        className="planner-dial-svg"
        height={constant.plannerDial.sizePx}
        onKeyDown={handleKeyDown}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={svgRef}
        role="slider"
        tabIndex={0}
        viewBox={`0 0 ${String(constant.plannerDial.sizePx)} ${String(constant.plannerDial.sizePx)}`}
        width={constant.plannerDial.sizePx}
      >
        <path
          className="planner-dial-track"
          d={resolveArcPath({
            center: constant.plannerDial.centerPx,
            endAngleDegrees: constant.plannerDial.startAngleDegrees + constant.plannerDial.angleRangeDegrees,
            radius: constant.plannerDial.radiusPx,
            startAngleDegrees: constant.plannerDial.startAngleDegrees,
          })}
        />
        {value > min && (
          <path
            className="planner-dial-fill"
            d={resolveArcPath({
              center: constant.plannerDial.centerPx,
              endAngleDegrees: valueAngleDegrees,
              radius: constant.plannerDial.radiusPx,
              startAngleDegrees: constant.plannerDial.startAngleDegrees,
            })}
          />
        )}
        <line
          className="planner-dial-needle"
          x1={constant.plannerDial.centerPx}
          x2={knobPoint.x}
          y1={constant.plannerDial.centerPx}
          y2={knobPoint.y}
        />
        <circle className="planner-dial-knob" cx={knobPoint.x} cy={knobPoint.y} r={constant.plannerDial.knobRadiusPx} />
      </svg>
      <span className="planner-dial-value">{formatValue(value)}</span>
    </div>
  )
}
