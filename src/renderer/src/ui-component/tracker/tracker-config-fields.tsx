import type { ReactElement } from 'react'

import { DayTimeScheduleFields } from '#src/renderer/src/ui-component/schedule/day-time-schedule-fields'
import { trackerTokenSourceUtil } from '#src/renderer/src/util/tracker-token-source-util'
import { ClaudeTokenSource } from '#src/shared/business/enum/claude-token-source-enum'
import type { OS } from '#src/shared/business/enum/os-enum'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import type { TrackerConfig } from '#src/shared/business/model/settings-model'
import { constant } from '#src/shared/util/constant'

const maxTrackerRefreshIntervalMinutes = constant.trackerRefreshInterval.maxMs / 60_000

const minTrackerRefreshIntervalMinutes = constant.trackerRefreshInterval.minMs / 60_000

export const TrackerConfigFields = (props: {
  config: TrackerConfig
  onChange: (config: TrackerConfig) => void
  osPlatform: OS
}): ReactElement => {
  const { config, onChange, osPlatform } = props
  const catalogEntry = constant.providerCatalog.find((entry) => {
    return entry.id === config.providerId
  })
  const providerDisplayName = catalogEntry?.name ?? config.providerId
  const { selectedTokenSource, systemTokenOption } = trackerTokenSourceUtil.resolveSelection({ config, osPlatform })

  return (
    <>
      <label className="settings-field">
        <span className="settings-field-label">Display name</span>
        <input
          className="settings-field-input"
          onChange={(event) => {
            onChange({ ...config, name: event.target.value })
          }}
          placeholder={providerDisplayName}
          type="text"
          value={config.name}
        />
      </label>
      {config.providerId === ProviderIdMapper.CLAUDE && (
        <div className="settings-field">
          <span className="settings-field-label">Access token</span>
          <div className="settings-token-source-row">
            <label className="settings-token-source-option">
              <input
                checked={selectedTokenSource === ClaudeTokenSource.MANUAL}
                name={`claude-token-source-${config.id}`}
                onChange={() => {
                  onChange({ ...config, tokenSource: ClaudeTokenSource.MANUAL })
                }}
                type="radio"
              />
              Enter manually
            </label>
            {systemTokenOption !== undefined && (
              <label className="settings-token-source-option">
                <input
                  checked={selectedTokenSource === ClaudeTokenSource.SYSTEM}
                  name={`claude-token-source-${config.id}`}
                  onChange={() => {
                    onChange({ ...config, tokenSource: ClaudeTokenSource.SYSTEM })
                  }}
                  type="radio"
                />
                {systemTokenOption.label}
              </label>
            )}
          </div>
          {selectedTokenSource === ClaudeTokenSource.MANUAL && (
            <input
              className="settings-field-input"
              onChange={(event) => {
                onChange({ ...config, accessToken: event.target.value })
              }}
              placeholder="OAuth access token from claude.ai"
              type="password"
              value={config.accessToken}
            />
          )}
          {selectedTokenSource === ClaudeTokenSource.SYSTEM && systemTokenOption !== undefined && (
            <p className="settings-hint">{systemTokenOption.hint}</p>
          )}
        </div>
      )}
      {config.providerId === ProviderIdMapper.ZAI && (
        <label className="settings-field">
          <span className="settings-field-label">Access token</span>
          <input
            className="settings-field-input"
            onChange={(event) => {
              onChange({ ...config, accessToken: event.target.value })
            }}
            placeholder="ANTHROPIC_AUTH_TOKEN from your GLM coding plan"
            type="password"
            value={config.accessToken}
          />
        </label>
      )}
      {config.providerId === ProviderIdMapper.DUMMY && (
        <>
          <DayTimeScheduleFields
            days={config.days}
            onChange={({ days, times }) => {
              onChange({ ...config, days, times })
            }}
            times={config.times}
          />
          <p className="settings-hint">
            Dev-only test tracker: shows a native macOS popup each time this schedule fires and never displays usage
            data.
          </p>
        </>
      )}
      <label className="settings-field">
        <span className="settings-field-label">Refresh interval (minutes)</span>
        <input
          className="settings-field-input"
          max={maxTrackerRefreshIntervalMinutes}
          min={minTrackerRefreshIntervalMinutes}
          onChange={(event) => {
            const minutes = Number.parseInt(event.target.value, 10)

            if (!Number.isFinite(minutes)) {
              return
            }

            const clampedMinutes = Math.min(
              Math.max(minutes, minTrackerRefreshIntervalMinutes),
              maxTrackerRefreshIntervalMinutes,
            )

            onChange({ ...config, refreshIntervalMs: clampedMinutes * 60_000 })
          }}
          type="number"
          value={Math.round(config.refreshIntervalMs / 60_000)}
        />
        <span className="settings-hint">How often this tracker refreshes automatically.</span>
      </label>
    </>
  )
}
