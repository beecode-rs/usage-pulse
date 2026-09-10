import { type ReactElement, useEffect, useState } from 'react'

import { PeakIcon } from '#src/renderer/src/ui-component/icon/peak-icon'
import { UsageBar } from '#src/renderer/src/ui-component/usage-dashboard/usage-bar'
import { dateUtil } from '#src/renderer/src/util/date-util'
import { MenuStatusUtil } from '#src/renderer/src/util/menu-status-util'
import { UsagePaceUtil } from '#src/renderer/src/util/usage-pace-util'
import { usageResetUtil } from '#src/renderer/src/util/usage-reset-util'
import { usageStatusUtil } from '#src/renderer/src/util/usage-status-util'
import { usageWindowUtil } from '#src/renderer/src/util/usage-window-util'
import { ZaiPeakUtil } from '#src/renderer/src/util/zai-peak-util'
import { type IProviderSnapshot, UsageStatus } from '#src/shared/usage-model'

const TICK_INTERVAL_MS = 30_000

const resolveStatusMessage = (params: { providerSnapshot: IProviderSnapshot }): string => {
  switch (params.providerSnapshot.status) {
    case UsageStatus.ERROR: {
      return params.providerSnapshot.errorMessage ?? usageStatusUtil.resolveStatusText(UsageStatus.ERROR)
    }

    case UsageStatus.PENDING: {
      return 'Loading usage…'
    }

    case UsageStatus.UNCONFIGURED: {
      return 'Add an access token to track usage.'
    }

    default: {
      return 'No usage windows returned.'
    }
  }
}

export const DashboardUsageBox = (props: { providerSnapshot: IProviderSnapshot }): ReactElement => {
  const { providerSnapshot } = props
  const [now, setNow] = useState((): number => {
    return Date.now()
  })

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(Date.now())
    }, TICK_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [])

  const fiveHourWindow = (providerSnapshot.usage ?? [])[0]
  const zaiPeakUtil = new ZaiPeakUtil()
  const peakInfo = zaiPeakUtil.resolvePeakInfo({ nowMs: now, providerId: providerSnapshot.providerId })
  const peakRemainingPercent = zaiPeakUtil.resolvePeakRemainingPercent({
    nowMs: now,
    providerId: providerSnapshot.providerId,
  })
  const peakRemainingText = zaiPeakUtil.resolvePeakRemainingText({
    nowMs: now,
    providerId: providerSnapshot.providerId,
  })

  const isWindowWarning = new MenuStatusUtil().resolveIsWindowWarning({
    now,
    resetAt: fiveHourWindow?.resetAt,
    usedPercent: fiveHourWindow?.usedPercent ?? 0,
    windowMs: fiveHourWindow?.windowMs ?? usageResetUtil.fiveHourWindowMs,
  })

  const resolveBoxClassName = (): string => {
    const classNames = ['dashboard-usage-box']

    if (peakInfo?.isPeakHour) {
      classNames.push('is-peak-hour')
    }

    if (isWindowWarning) {
      classNames.push('is-warning')
    }

    return classNames.join(' ')
  }

  const renderPeakPill = (): ReactElement | undefined => {
    if (!peakInfo?.isPeakHour) {
      return undefined
    }

    const tooltipText = [
      `3× peak ends in ${peakRemainingText ?? 'under 1m'}.`,
      'Premium models are billed at 3× credits during peak hours and 1× off-peak.',
      `Peak hours are weekdays 14:00–18:00 (UTC+8) — ${peakInfo.peakWindowText} your time.`,
    ].join('\n')

    return (
      <span
        aria-label={tooltipText}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(peakRemainingPercent ?? 0)}
        className="dashboard-peak-pill"
        data-tooltip={tooltipText}
        role="meter"
      >
        <span
          aria-hidden="true"
          className="dashboard-peak-pill-fill"
          style={{ width: `${String(peakRemainingPercent ?? 0)}%` }}
        />
        <PeakIcon />
        <span className="dashboard-peak-pill-text">{peakRemainingText ?? 'under 1m'}</span>
      </span>
    )
  }

  const renderResetBar = (params: { paceFillColor?: string; windowMs: number }): ReactElement => {
    const resetAt = fiveHourWindow?.resetAt

    if (resetAt === undefined) {
      return (
        <UsageBar
          ariaLabel={`${providerSnapshot.trackerName} reset inactive`}
          label="Reset"
          percent={0}
          valueText="no active window"
        />
      )
    }

    const remainingMs = usageResetUtil.resolveRemainingMs({ now, resetAt })

    return (
      <UsageBar
        ariaLabel={`time until ${providerSnapshot.trackerName} reset`}
        fillAnchor="right"
        fillColor={params.paceFillColor}
        label="Reset"
        percent={usageResetUtil.resolveRemainingPercent({ remainingMs, windowMs: params.windowMs })}
        valueText={usageResetUtil.resolveRemainingText({ remainingMs })}
        valueTooltip={`Resets at ${dateUtil.formatDateTime(resetAt)}`}
      />
    )
  }

  const renderBars = (): ReactElement | undefined => {
    if (providerSnapshot.status !== UsageStatus.OK || fiveHourWindow === undefined) {
      return undefined
    }

    const windowMs = fiveHourWindow.windowMs ?? usageResetUtil.fiveHourWindowMs
    const paceFillColor = new UsagePaceUtil().resolvePaceColor({
      now,
      resetAt: fiveHourWindow.resetAt,
      usedPercent: fiveHourWindow.usedPercent,
      windowMs,
    })

    return (
      <div className="dashboard-box-bars">
        <UsageBar
          ariaLabel={`${providerSnapshot.trackerName} usage`}
          fillColor={paceFillColor}
          label="Usage"
          percent={fiveHourWindow.usedPercent}
          valueText={usageWindowUtil.resolveValueText({
            totalAmount: fiveHourWindow.totalAmount,
            usedAmount: fiveHourWindow.usedAmount,
            usedPercent: fiveHourWindow.usedPercent,
          })}
        />
        {renderResetBar({ paceFillColor, windowMs })}
      </div>
    )
  }

  const renderBody = (): ReactElement => {
    const bars = renderBars()

    if (bars === undefined) {
      return <p className="dashboard-usage-box-message">{resolveStatusMessage({ providerSnapshot })}</p>
    }

    return bars
  }

  return (
    <section className={resolveBoxClassName()}>
      <header className="dashboard-usage-box-header">
        <div className="dashboard-usage-box-heading">
          <h2 className="dashboard-usage-box-title">{providerSnapshot.trackerName}</h2>
          {renderPeakPill()}
        </div>
        {fiveHourWindow !== undefined && <span className="dashboard-usage-box-window">{fiveHourWindow.label}</span>}
      </header>
      {renderBody()}
    </section>
  )
}
