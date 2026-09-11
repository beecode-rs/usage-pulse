import type { ReactElement } from 'react'

import { PeakIcon } from '#src/renderer/src/ui-component/icon/peak-icon'
import { RefreshIcon } from '#src/renderer/src/ui-component/icon/refresh-icon'
import { ProviderIcon } from '#src/renderer/src/ui-component/provider/provider-icon'
import { UsageBar } from '#src/renderer/src/ui-component/usage-dashboard/usage-bar'
import { UsageWindowBox } from '#src/renderer/src/ui-component/usage-dashboard/usage-window-box'
import { dateUtil } from '#src/renderer/src/util/date-util'
import { usageResetUtil } from '#src/renderer/src/util/usage-reset-util'
import { usageStatusUtil } from '#src/renderer/src/util/usage-status-util'
import { ZaiPeakUtil } from '#src/renderer/src/util/zai-peak-util'
import { UsageStatus } from '#src/shared/business/enum/usage-status-enum'
import { type ProviderSnapshot } from '#src/shared/business/model/usage-model'

export const ProviderUsageCard = (props: {
  isAutoRefreshPaused: boolean
  isRefreshing: boolean
  nowMs: number
  onOpenSettings: () => void
  onRefresh: () => void
  onToggleAutoRefresh: () => void
  providerSnapshot: ProviderSnapshot
  refreshIntervalMs?: number
}): ReactElement => {
  const {
    isAutoRefreshPaused,
    isRefreshing,
    nowMs,
    onOpenSettings,
    onRefresh,
    onToggleAutoRefresh,
    providerSnapshot,
    refreshIntervalMs,
  } = props
  const usageWindows = providerSnapshot.usage ?? []
  const primaryWindow = usageWindows[0]
  const secondaryWindows = usageWindows.slice(1)
  const zaiPeakUtil = new ZaiPeakUtil()
  const peakInfo = zaiPeakUtil.resolvePeakInfo({ nowMs, providerId: providerSnapshot.providerId })
  const peakRemainingPercent = zaiPeakUtil.resolvePeakRemainingPercent({
    nowMs,
    providerId: providerSnapshot.providerId,
  })
  const peakRemainingText = zaiPeakUtil.resolvePeakRemainingText({ nowMs, providerId: providerSnapshot.providerId })

  const resolveCardClassName = (): string => {
    if (peakInfo?.isPeakHour === true) {
      return 'provider-card is-peak-hour'
    }

    return 'provider-card'
  }

  const resolveRefreshButtonClassName = (): string => {
    if (isRefreshing) {
      return 'provider-card-refresh is-refreshing'
    }

    return 'provider-card-refresh'
  }

  const resolvePauseButtonClassName = (): string => {
    if (isAutoRefreshPaused) {
      return 'provider-card-pause is-paused'
    }

    return 'provider-card-pause'
  }

  const resolvePauseButtonLabel = (): string => {
    if (isAutoRefreshPaused) {
      return 'Resume auto-refresh'
    }

    return 'Pause auto-refresh'
  }

  const resolveStatusText = (): string => {
    if (isAutoRefreshPaused && providerSnapshot.status === UsageStatus.OK) {
      return 'Paused'
    }

    return usageStatusUtil.resolveStatusText(providerSnapshot.status)
  }

  const resolveStatusClassName = (): string => {
    if (isAutoRefreshPaused && providerSnapshot.status === UsageStatus.OK) {
      return 'provider-card-status provider-card-status-paused'
    }

    return `provider-card-status provider-card-status-${providerSnapshot.status.toLowerCase()}`
  }

  const renderPauseIcon = (): ReactElement => {
    if (isAutoRefreshPaused) {
      return (
        <svg fill="none" height="15" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="15">
          <polygon points="6 4 20 12 6 20 6 4" />
        </svg>
      )
    }

    return (
      <svg fill="none" height="15" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="15">
        <line x1="9" x2="9" y1="5" y2="19" />
        <line x1="15" x2="15" y1="5" y2="19" />
      </svg>
    )
  }

  const resolvePendingMessage = (): string => {
    if (isAutoRefreshPaused) {
      return 'Auto-refresh is paused. Refresh to load usage.'
    }

    return 'Loading usage…'
  }

  const renderPeakProgressBar = (params: { percent: number }): ReactElement => {
    return (
      <div
        aria-label="Time remaining in z.ai peak hours"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(params.percent)}
        className="provider-card-peak-progress-track"
        role="meter"
      >
        <div className="provider-card-peak-progress-fill" style={{ width: `${String(params.percent)}%` }} />
      </div>
    )
  }

  const renderPeakBanner = (): ReactElement | undefined => {
    if (peakInfo === undefined) {
      return undefined
    }

    const tooltipText = [
      'Premium models are billed at 3× credits during peak hours and 1× off-peak.',
      'Peak hours are weekdays 14:00–18:00 (UTC+8).',
      `Your local peak window: ${peakInfo.peakWindowText}.`,
    ].join('\n')

    if (peakInfo.isPeakHour) {
      return (
        <div aria-label={tooltipText} className="provider-card-peak-banner is-peak-active" data-tooltip={tooltipText}>
          <PeakIcon />
          <span>3× peak ends in {peakRemainingText ?? 'under 1m'}</span>
          {renderPeakProgressBar({ percent: peakRemainingPercent ?? 0 })}
        </div>
      )
    }

    return (
      <div aria-label={tooltipText} className="provider-card-peak-banner" data-tooltip={tooltipText}>
        <PeakIcon />
        <span>Peak hours {peakInfo.peakWindowText} your time</span>
      </div>
    )
  }

  const resolveIsSnapshotStale = (): boolean => {
    if (refreshIntervalMs === undefined || providerSnapshot.fetchedAt === undefined) {
      return false
    }

    return nowMs - providerSnapshot.fetchedAt > refreshIntervalMs
  }

  const renderLastFetchedItem = (): ReactElement | undefined => {
    if (providerSnapshot.fetchedAt === undefined) {
      return undefined
    }

    const tooltipText = `Last fetched at ${dateUtil.formatDateTime(providerSnapshot.fetchedAt)}`

    if (resolveIsSnapshotStale()) {
      return (
        <span aria-label={tooltipText} className="provider-card-footer-item is-stale" data-tooltip={tooltipText}>
          <svg
            fill="none"
            height="13"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="13"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" x2="12" y1="9" y2="13" />
            <line x1="12" x2="12.01" y1="17" y2="17" />
          </svg>
          Stale
        </span>
      )
    }

    return (
      <span aria-label={tooltipText} className="provider-card-footer-item" data-tooltip={tooltipText}>
        <svg
          fill="none"
          height="13"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="13"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {dateUtil.formatHourMinute(providerSnapshot.fetchedAt)}
      </span>
    )
  }

  const renderIntervalItem = (): ReactElement | undefined => {
    if (refreshIntervalMs === undefined) {
      return undefined
    }

    const intervalText = dateUtil.formatDuration(refreshIntervalMs)

    const resolveIntervalTooltipText = (): string => {
      if (isAutoRefreshPaused) {
        return `Refresh interval ${intervalText} — auto-refresh paused`
      }

      return `Auto-refreshes every ${intervalText}`
    }

    const tooltipText = resolveIntervalTooltipText()

    return (
      <span aria-label={tooltipText} className="provider-card-footer-item is-pushed-right" data-tooltip={tooltipText}>
        <svg
          fill="none"
          height="13"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="13"
        >
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        {intervalText}
      </span>
    )
  }

  const resolveRefreshProgressPercent = (): number | undefined => {
    if (isAutoRefreshPaused || providerSnapshot.nextRefreshAt === undefined || refreshIntervalMs === undefined) {
      return undefined
    }

    const remainingMs = Math.max(0, providerSnapshot.nextRefreshAt - nowMs)
    const elapsedMs = refreshIntervalMs - remainingMs

    return Math.min(100, Math.max(0, (elapsedMs / refreshIntervalMs) * 100))
  }

  const pauseButtonLabel = resolvePauseButtonLabel()
  const footerItems = [renderLastFetchedItem(), renderIntervalItem()].filter((item): item is ReactElement => {
    return item !== undefined
  })
  const refreshProgressPercent = resolveRefreshProgressPercent()
  const hasFooterContent = footerItems.length > 0 || refreshProgressPercent !== undefined

  return (
    <section className={resolveCardClassName()}>
      <header className="provider-card-header">
        <div className="provider-card-heading">
          <ProviderIcon providerId={providerSnapshot.providerId} />
          <h2 className="provider-card-title">{providerSnapshot.trackerName}</h2>
        </div>
        <div className="provider-card-actions">
          <span className={resolveStatusClassName()}>{resolveStatusText()}</span>
          <button
            aria-label={pauseButtonLabel}
            className={resolvePauseButtonClassName()}
            onClick={onToggleAutoRefresh}
            title={pauseButtonLabel}
            type="button"
          >
            {renderPauseIcon()}
          </button>
          <button
            aria-label="Refresh tracker"
            className={resolveRefreshButtonClassName()}
            disabled={isRefreshing}
            onClick={onRefresh}
            title="Refresh tracker"
            type="button"
          >
            <RefreshIcon />
          </button>
          <button
            aria-label="Tracker settings"
            className="provider-card-gear"
            onClick={onOpenSettings}
            title="Tracker settings"
            type="button"
          >
            <svg
              fill="none"
              height="15"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="15"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>
      {renderPeakBanner()}
      {providerSnapshot.status === UsageStatus.OK && primaryWindow !== undefined && (
        <div className="provider-card-body">
          <UsageWindowBox
            resetAt={primaryWindow.resetAt}
            title={primaryWindow.label}
            totalAmount={primaryWindow.totalAmount}
            usedAmount={primaryWindow.usedAmount}
            usedPercent={primaryWindow.usedPercent}
            windowMs={primaryWindow.windowMs ?? usageResetUtil.fiveHourWindowMs}
          />
          <div className="provider-card-windows">
            {secondaryWindows.map((usageWindow) => {
              if (usageWindow.windowMs !== undefined) {
                return (
                  <UsageWindowBox
                    key={usageWindow.label}
                    resetAt={usageWindow.resetAt}
                    title={usageWindow.label}
                    totalAmount={usageWindow.totalAmount}
                    usedAmount={usageWindow.usedAmount}
                    usedPercent={usageWindow.usedPercent}
                    windowMs={usageWindow.windowMs}
                  />
                )
              }

              return <UsageBar key={usageWindow.label} label={usageWindow.label} percent={usageWindow.usedPercent} />
            })}
          </div>
        </div>
      )}
      {providerSnapshot.status === UsageStatus.PENDING && (
        <p className="provider-card-message">{resolvePendingMessage()}</p>
      )}
      {providerSnapshot.status === UsageStatus.UNCONFIGURED && (
        <p className="provider-card-message">Add an access token in this tracker&apos;s settings to track usage.</p>
      )}
      {providerSnapshot.status === UsageStatus.ERROR && (
        <p className="provider-card-message provider-card-message-error">{providerSnapshot.errorMessage}</p>
      )}
      {providerSnapshot.status === UsageStatus.OK && primaryWindow === undefined && (
        <p className="provider-card-message">No usage windows returned.</p>
      )}
      {hasFooterContent && (
        <footer className="provider-card-footer">
          {footerItems.length > 0 && <div className="provider-card-footer-meta">{footerItems}</div>}
          {refreshProgressPercent !== undefined && (
            <div
              aria-label="Time until next auto-refresh"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(refreshProgressPercent)}
              className="provider-card-progress-track"
              role="meter"
            >
              <div className="provider-card-progress-fill" style={{ width: `${String(refreshProgressPercent)}%` }} />
            </div>
          )}
        </footer>
      )}
    </section>
  )
}
