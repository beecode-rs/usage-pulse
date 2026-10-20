import { type ReactElement, useState } from 'react'

import '#src/renderer/src/ui-component/development/development-page.css'
import { usageSeverityService } from '#src/renderer/src/business/service/usage-severity-service'
import { ZaiPeakService } from '#src/renderer/src/business/service/zai-peak-service'
import { DevelopmentSelectField } from '#src/renderer/src/ui-component/development/select-field'
import { DevelopmentSliderField } from '#src/renderer/src/ui-component/development/slider-field'
import { UsageDashboardProviderUsageCard } from '#src/renderer/src/ui-component/usage-dashboard/provider-usage-card'
import { constant } from '#src/renderer/src/util/constant'
import { dateUtil } from '#src/renderer/src/util/date-util'
import { usageResetUtil } from '#src/renderer/src/util/usage-reset-util'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { UsageActivityStatus } from '#src/shared/business/enum/usage-activity-status-enum'
import { type ProviderSnapshot } from '#src/shared/business/model/usage-model'
import { constant as sharedConstant } from '#src/shared/util/constant'

export const DevelopmentPage = (props: {
  elapsedMinutes: number
  onElapsedMinutesChange: (elapsedMinutes: number) => void
  onUsedPercentChange: (usedPercent: number) => void
  usedPercent: number
}): ReactElement => {
  const { elapsedMinutes, onElapsedMinutesChange, onUsedPercentChange, usedPercent } = props

  const zaiPeakService = new ZaiPeakService()

  const [fetchedElapsedMinutes, setFetchedElapsedMinutes] = useState(
    constant.development.page.defaultFetchedElapsedMinutes,
  )
  const [minuteOfDay, setMinuteOfDay] = useState((): number => {
    const now = new Date()

    return now.getHours() * constant.development.page.minutesPerHour + now.getMinutes()
  })
  const [weekdayValue, setWeekdayValue] = useState((): string => {
    return String(new Date().getDay())
  })
  const [isPreviewAutoRefreshPaused, setIsPreviewAutoRefreshPaused] = useState(false)
  const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false)

  const resolvePreviewNowMs = (): number => {
    const today = new Date()
    const matchingOffset = constant.development.page.dayOffsets.find((offset) => {
      const candidateDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)

      return candidateDate.getDay() === Number(weekdayValue)
    })

    if (matchingOffset === undefined) {
      return Date.now()
    }

    const previewDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + matchingOffset)

    previewDate.setHours(
      Math.floor(minuteOfDay / constant.development.page.minutesPerHour),
      minuteOfDay % constant.development.page.minutesPerHour,
      0,
      0,
    )

    return previewDate.getTime()
  }

  const resolveResetAt = (): number => {
    const elapsedMs = elapsedMinutes * 60_000

    return Date.now() + usageResetUtil.fiveHourWindowMs - elapsedMs
  }

  const resolveMonthlyResetAt = (): number => {
    const elapsedFraction = elapsedMinutes / constant.development.elapsedMinutes.max
    const elapsedMs = elapsedFraction * sharedConstant.thirtyDayWindowMs

    return Date.now() + sharedConstant.thirtyDayWindowMs - elapsedMs
  }

  const resolveMcpUsedCalls = (): number => {
    return Math.round(
      (usedPercent / constant.development.page.usedPercent.max) * constant.development.page.preview.mcpTotalCalls,
    )
  }

  const resolvePreviewSnapshot = (): ProviderSnapshot => {
    const previewNowMs = resolvePreviewNowMs()

    return {
      fetchedAt: previewNowMs - fetchedElapsedMinutes * 60_000,
      nextRefreshAt: previewNowMs + constant.development.page.preview.nextRefreshOffsetMs,
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
          totalAmount: constant.development.page.preview.mcpTotalCalls,
          usedAmount: resolveMcpUsedCalls(),
          usedPercent,
          windowMs: sharedConstant.thirtyDayWindowMs,
        },
      ],
    }
  }

  const resolveUsageValueText = (): string => {
    const severityLabel = usageSeverityService.resolveSeverityLabel(usedPercent)
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
    const hourText = String(Math.floor(minuteOfDay / constant.development.page.minutesPerHour)).padStart(2, '0')
    const minuteText = String(minuteOfDay % constant.development.page.minutesPerHour).padStart(2, '0')

    return `${hourText}:${minuteText}`
  }

  const resolvePeakHintText = (): string => {
    const peakWindowText = zaiPeakService.resolvePeakInfo({
      nowMs: Date.now(),
      providerId: ProviderIdMapper.ZAI,
    })?.peakWindowText

    return `Peak tint: weekdays ${peakWindowText ?? '14:00–18:00'} your time (14:00–18:00 UTC+8)`
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
    }, constant.development.page.preview.refreshSpinMs)
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
          window, data age, and time of week. Time of day and Day use your local clock: the z.ai card tints amber on
          weekdays during the peak window shown on the card.
        </p>
      </header>
      <UsageDashboardProviderUsageCard
        isAutoRefreshPaused={isPreviewAutoRefreshPaused}
        isRefreshing={isPreviewRefreshing}
        nowMs={resolvePreviewNowMs()}
        onOpenSettings={handlePreviewOpenSettings}
        onRefresh={handlePreviewRefresh}
        onToggleAutoRefresh={handlePreviewToggleAutoRefresh}
        providerSnapshot={resolvePreviewSnapshot()}
        refreshIntervalMs={constant.development.page.preview.refreshIntervalMs}
      />
      <section className="development-page-panel">
        <DevelopmentSliderField
          label="Usage"
          max={constant.development.page.usedPercent.max}
          onChange={onUsedPercentChange}
          value={usedPercent}
          valueText={resolveUsageValueText()}
        />
        <DevelopmentSliderField
          label="Reset"
          max={constant.development.elapsedMinutes.max}
          onChange={onElapsedMinutesChange}
          value={elapsedMinutes}
          valueText={resolveElapsedValueText()}
        />
        <DevelopmentSliderField
          label="Fetched"
          max={constant.development.page.fetchedElapsedMinutes.max}
          onChange={setFetchedElapsedMinutes}
          value={fetchedElapsedMinutes}
          valueText={resolveFetchedValueText()}
        />
        <DevelopmentSliderField
          label="Time of day"
          max={constant.development.page.minuteOfDay.max}
          onChange={setMinuteOfDay}
          value={minuteOfDay}
          valueText={resolveTimeValueText()}
        />
        <DevelopmentSelectField
          label="Day"
          onChange={setWeekdayValue}
          options={constant.development.page.weekdayOptions}
          value={weekdayValue}
        />
        <p className="development-page-hint">{resolvePeakHintText()}</p>
      </section>
      <section className="development-page-panel">
        <h2 className="development-page-section-title">Color bands</h2>
        <ul className="development-page-bands">
          {constant.development.page.severityBands.map((band) => {
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
