import {
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
} from 'react'

import { PlannerDialToneMapper } from '#src/renderer/src/business/enum/planner-dial-tone-mapper-enum'
import { constant } from '#src/renderer/src/util/constant'
import { PlannerDialUtil } from '#src/renderer/src/util/planner-dial-util'

const DIAL_SIZE = 76

const DIAL_CENTER = DIAL_SIZE / 2

const DIAL_KNOB_RADIUS = 3.5

const DIAL_RADIUS = DIAL_SIZE / 2 - 7

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

export const PlannerDial = (props: {
  formatValue: (value: number) => string
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  step: number
  tone?: PlannerDialToneMapper
  value: number
}): ReactElement => {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const isDraggingRef = useRef(false)
  const plannerDialUtil = new PlannerDialUtil()

  const valueAngleDegrees = plannerDialUtil.resolveValueAngleDegrees({
    max: props.max,
    min: props.min,
    value: props.value,
  })
  const knobPoint = resolvePointOnCircle({
    angleDegrees: valueAngleDegrees,
    center: DIAL_CENTER,
    radius: DIAL_RADIUS,
  })

  const publishValue = (nextValue: number): void => {
    if (nextValue === props.value) {
      return
    }

    props.onChange(nextValue)
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
        max: props.max,
        min: props.min,
        step: props.step,
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
      max: props.max,
      min: props.min,
      step: props.step,
      value: props.value,
    })

    if (nextValue === props.value) {
      return
    }

    event.preventDefault()
    props.onChange(nextValue)
  }

  return (
    <div className={resolveDialClassName(props.tone)}>
      <span className="planner-dial-label">{props.label}</span>
      <svg
        aria-label={props.label}
        aria-valuemax={props.max}
        aria-valuemin={props.min}
        aria-valuenow={props.value}
        aria-valuetext={props.formatValue(props.value)}
        className="planner-dial-svg"
        height={DIAL_SIZE}
        onKeyDown={handleKeyDown}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={svgRef}
        role="slider"
        tabIndex={0}
        viewBox={`0 0 ${String(DIAL_SIZE)} ${String(DIAL_SIZE)}`}
        width={DIAL_SIZE}
      >
        <path
          className="planner-dial-track"
          d={resolveArcPath({
            center: DIAL_CENTER,
            endAngleDegrees: constant.plannerDialStartAngleDegrees + constant.plannerDialAngleRangeDegrees,
            radius: DIAL_RADIUS,
            startAngleDegrees: constant.plannerDialStartAngleDegrees,
          })}
        />
        {props.value > props.min && (
          <path
            className="planner-dial-fill"
            d={resolveArcPath({
              center: DIAL_CENTER,
              endAngleDegrees: valueAngleDegrees,
              radius: DIAL_RADIUS,
              startAngleDegrees: constant.plannerDialStartAngleDegrees,
            })}
          />
        )}
        <line className="planner-dial-needle" x1={DIAL_CENTER} x2={knobPoint.x} y1={DIAL_CENTER} y2={knobPoint.y} />
        <circle className="planner-dial-knob" cx={knobPoint.x} cy={knobPoint.y} r={DIAL_KNOB_RADIUS} />
      </svg>
      <span className="planner-dial-value">{props.formatValue(props.value)}</span>
    </div>
  )
}
