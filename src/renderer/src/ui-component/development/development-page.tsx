import { type ReactElement, useState } from 'react'

import '#src/renderer/src/ui-component/development/development-page.css'
import { SelectField } from '#src/renderer/src/ui-component/development/select-field'
import { SliderField } from '#src/renderer/src/ui-component/development/slider-field'
import { ProviderUsageCard } from '#src/renderer/src/ui-component/usage-dashboard/provider-usage-card'
import { dateUtil } from '#src/renderer/src/util/date-util'
import { usageResetUtil } from '#src/renderer/src/util/usage-reset-util'
import { usageSeverityUtil } from '#src/renderer/src/util/usage-severity-util'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { UsageActivityStatus } from '#src/shared/business/enum/usage-activity-status-enum'
import { type ProviderSnapshot } from '#src/shared/business/model/usage-model'
import { constant } from '#src/shared/util/constant'

const DEFAULT_FETCHED_ELAPSED_MINUTES = 1
const MAX_ELAPSED_MINUTES = 300
const MAX_FETCHED_ELAPSED_MINUTES = 3 * 24 * 60
const MAX_MINUTE_OF_DAY = 23 * 60 + 59
const MAX_USED_PERCENT = 100
const MINUTES_PER_HOUR = 60
const PREVIEW_MCP_TOTAL_CALLS = 1000
const PREVIEW_NEXT_REFRESH_OFFSET_MS = 150_000
const PREVIEW_REFRESH_INTERVAL_MS = 300_000
const PREVIEW_REFRESH_SPIN_MS = 1000

const DAY_OFFSETS = [0, 1, 2, 3, 4, 5, 6]

const WEEKDAY_OPTIONS = [
  { label: 'Monday', value: '1' },
  { label: 'Tuesday', value: '2' },
  { label: 'Wednesday', value: '3' },
  { label: 'Thursday', value: '4' },
  { label: 'Friday', value: '5' },
  { label: 'Saturday', value: '6' },
  { label: 'Sunday', value: '0' },
]

const SEVERITY_BANDS = [
  { colorVar: 'var(--meter-accent)', label: 'Normal', range: '0–69%' },
  { colorVar: 'var(--meter-warning)', label: 'Filling up', range: '70–84%' },
  { colorVar: 'var(--meter-serious)', label: 'High usage', range: '85–94%' },
  { colorVar: 'var(--meter-critical)', label: 'Limit reached', range: '95–100%' },
]

export const DevelopmentPage = (props: {
  elapsedMinutes: number
  onElapsedMinutesChange: (elapsedMinutes: number) => void
  onUsedPercentChange: (usedPercent: number) => void
  usedPercent: number
}): ReactElement => {
  const { elapsedMinutes, onElapsedMinutesChange, onUsedPercentChange, usedPercent } = props

  const [fetchedElapsedMinutes, setFetchedElapsedMinutes] = useState(DEFAULT_FETCHED_ELAPSED_MINUTES)
  const [minuteOfDay, setMinuteOfDay] = useState((): number => {
    const now = new Date()

    return now.getHours() * MINUTES_PER_HOUR + now.getMinutes()
  })
  const [weekdayValue, setWeekdayValue] = useState((): string => {
    return String(new Date().getDay())
  })
  const [isPreviewAutoRefreshPaused, setIsPreviewAutoRefreshPaused] = useState(false)
  const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false)

  const resolvePreviewNowMs = (): number => {
    const today = new Date()
    const matchingOffset = DAY_OFFSETS.find((offset) => {
      const candidateDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)

      return candidateDate.getDay() === Number(weekdayValue)
    })

    if (matchingOffset === undefined) {
      return Date.now()
    }

    const previewDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + matchingOffset)

    previewDate.setHours(Math.floor(minuteOfDay / MINUTES_PER_HOUR), minuteOfDay % MINUTES_PER_HOUR, 0, 0)

    return previewDate.getTime()
  }

  const resolveResetAt = (): number => {
    const elapsedMs = elapsedMinutes * 60_000

    return Date.now() + usageResetUtil.fiveHourWindowMs - elapsedMs
  }

  const resolveMonthlyResetAt = (): number => {
    const elapsedFraction = elapsedMinutes / MAX_ELAPSED_MINUTES
    const elapsedMs = elapsedFraction * constant.thirtyDayWindowMs

    return Date.now() + constant.thirtyDayWindowMs - elapsedMs
  }

  const resolveMcpUsedCalls = (): number => {
    return Math.round((usedPercent / MAX_USED_PERCENT) * PREVIEW_MCP_TOTAL_CALLS)
  }

  const resolvePreviewSnapshot = (): ProviderSnapshot => {
    const previewNowMs = resolvePreviewNowMs()

    return {
      fetchedAt: previewNowMs - fetchedElapsedMinutes * 60_000,
      nextRefreshAt: previewNowMs + PREVIEW_NEXT_REFRESH_OFFSET_MS,
      providerId: ProviderIdMapper.ZAI,
      status: UsageActivityStatus.OK,
      trackerId: 'development-zai',
      trackerName: 'z.ai',
      usage: [
        {
          label: '5-hour window',
          resetAt: resolveResetAt(),
          usedPercent,
          windowMs: usageResetUtil.fiveHourWindowMs,
        },
        {
          label: 'MCP quota',
          resetAt: resolveMonthlyResetAt(),
          totalAmount: PREVIEW_MCP_TOTAL_CALLS,
          usedAmount: resolveMcpUsedCalls(),
          usedPercent,
          windowMs: constant.thirtyDayWindowMs,
        },
      ],
    }
  }

  const resolveUsageValueText = (): string => {
    const severityLabel = usageSeverityUtil.resolveSeverityLabel(usedPercent)
    const percentText = `${String(usedPercent)}%`

    if (severityLabel === '') {
      return percentText
    }

    return `${percentText} · ${severityLabel}`
  }

  const resolveElapsedValueText = (): string => {
    const elapsedText = dateUtil.formatDuration(elapsedMinutes * 60_000)

    return `${elapsedText} elapsed`
  }

  const resolveFetchedValueText = (): string => {
    const elapsedText = dateUtil.formatDuration(fetchedElapsedMinutes * 60_000)

    return `${elapsedText} ago`
  }

  const resolveTimeValueText = (): string => {
    const timeDate = new Date()

    timeDate.setHours(Math.floor(minuteOfDay / MINUTES_PER_HOUR), minuteOfDay % MINUTES_PER_HOUR, 0, 0)

    return dateUtil.formatHourMinute(timeDate.getTime())
  }

  const handlePreviewToggleAutoRefresh = (): void => {
    setIsPreviewAutoRefreshPaused((isPaused) => {
      return !isPaused
    })
  }

  const handlePreviewRefresh = (): void => {
    setIsPreviewRefreshing(true)
    setTimeout(() => {
      setIsPreviewRefreshing(false)
    }, PREVIEW_REFRESH_SPIN_MS)
  }

  const handlePreviewOpenSettings = (): void => {
    return
  }

  return (
    <div className="development-page">
      <header>
        <h1 className="development-page-title">Development</h1>
        <p className="development-page-subtitle">
          Drag the sliders and pick a day to preview the provider card at any usage level, point in the five hour
          window, data age, and time of week. The z.ai card tints amber during peak hours (weekdays 14:00–18:00 UTC+8).
        </p>
      </header>
      <ProviderUsageCard
        isAutoRefreshPaused={isPreviewAutoRefreshPaused}
        isRefreshing={isPreviewRefreshing}
        nowMs={resolvePreviewNowMs()}
        onOpenSettings={handlePreviewOpenSettings}
        onRefresh={handlePreviewRefresh}
        onToggleAutoRefresh={handlePreviewToggleAutoRefresh}
        providerSnapshot={resolvePreviewSnapshot()}
        refreshIntervalMs={PREVIEW_REFRESH_INTERVAL_MS}
      />
      <section className="development-page-panel">
        <SliderField
          label="Usage"
          max={MAX_USED_PERCENT}
          onChange={onUsedPercentChange}
          value={usedPercent}
          valueText={resolveUsageValueText()}
        />
        <SliderField
          label="Reset"
          max={MAX_ELAPSED_MINUTES}
          onChange={onElapsedMinutesChange}
          value={elapsedMinutes}
          valueText={resolveElapsedValueText()}
        />
        <SliderField
          label="Fetched"
          max={MAX_FETCHED_ELAPSED_MINUTES}
          onChange={setFetchedElapsedMinutes}
          value={fetchedElapsedMinutes}
          valueText={resolveFetchedValueText()}
        />
        <SliderField
          label="Time of day"
          max={MAX_MINUTE_OF_DAY}
          onChange={setMinuteOfDay}
          value={minuteOfDay}
          valueText={resolveTimeValueText()}
        />
        <SelectField label="Day" onChange={setWeekdayValue} options={WEEKDAY_OPTIONS} value={weekdayValue} />
      </section>
      <section className="development-page-panel">
        <h2 className="development-page-section-title">Color bands</h2>
        <ul className="development-page-bands">
          {SEVERITY_BANDS.map((band) => {
            return (
              <li className="development-page-band" key={band.label}>
                <span className="development-page-band-swatch" style={{ backgroundColor: band.colorVar }} />
                <span className="development-page-band-label">{band.label}</span>
                <span className="development-page-band-range">{band.range}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
