import type { ReactElement } from 'react'

import { DayTimeScheduleFields } from '#src/renderer/src/ui-component/schedule/day-time-schedule-fields'
import { trackerAccessTokenSourceUtil } from '#src/renderer/src/util/tracker-access-token-source-util'
import { ClaudeAccessTokenSource } from '#src/shared/business/enum/claude-access-token-source-enum'
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
  const { selectedAccessTokenSource, systemAccessTokenOption } = trackerAccessTokenSourceUtil.resolveSelection({
    config,
    osPlatform,
  })

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
          <div className="settings-access-token-source-row">
            <label className="settings-access-token-source-option">
              <input
                checked={selectedAccessTokenSource === ClaudeAccessTokenSource.MANUAL}
                name={`claude-access-token-source-${config.id}`}
                onChange={() => {
                  onChange({ ...config, accessTokenSource: ClaudeAccessTokenSource.MANUAL })
                }}
                type="radio"
              />
              Enter manually
            </label>
            {systemAccessTokenOption !== undefined && (
              <label className="settings-access-token-source-option">
                <input
                  checked={selectedAccessTokenSource === ClaudeAccessTokenSource.SYSTEM}
                  name={`claude-access-token-source-${config.id}`}
                  onChange={() => {
                    onChange({ ...config, accessTokenSource: ClaudeAccessTokenSource.SYSTEM })
                  }}
                  type="radio"
                />
                {systemAccessTokenOption.label}
              </label>
            )}
          </div>
          {selectedAccessTokenSource === ClaudeAccessTokenSource.MANUAL && (
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
          {selectedAccessTokenSource === ClaudeAccessTokenSource.SYSTEM && systemAccessTokenOption !== undefined && (
            <p className="settings-hint">{systemAccessTokenOption.hint}</p>
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
