import { type ReactElement, useEffect, useState } from 'react'

import { usageClientService } from '#src/renderer/src/business/service/usage-client-service'
import { AddTrackerDialog } from '#src/renderer/src/ui-component/tracker/add-tracker-dialog'
import { TrackerSettingsDialog } from '#src/renderer/src/ui-component/tracker/tracker-settings-dialog'
import { DashboardAddButton } from '#src/renderer/src/ui-component/usage-dashboard/dashboard-add-button'
import { ProviderUsageCard } from '#src/renderer/src/ui-component/usage-dashboard/provider-usage-card'
import '#src/renderer/src/ui-component/usage-dashboard/usage-dashboard.css'
import type { AppSettings } from '#src/shared/business/model/settings-model'
import type { UsageSnapshot } from '#src/shared/business/model/usage-model'

const NOW_TICK_INTERVAL_MS = 1000

export const UsageDashboard = (): ReactElement => {
  const [snapshot, setSnapshot] = useState<UsageSnapshot | undefined>(undefined)
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [nowMs, setNowMs] = useState((): number => {
    return Date.now()
  })
  const [openTrackerId, setOpenTrackerId] = useState<string | undefined>(undefined)
  const [refreshingTrackerIds, setRefreshingTrackerIds] = useState<string[]>([])

  const loadSettings = async (): Promise<void> => {
    const loadedSettings = await usageClientService.getSettings()

    setSettings(loadedSettings)
  }

  const loadSnapshot = async (): Promise<void> => {
    const currentSnapshot = await usageClientService.getSnapshot()

    setSnapshot(currentSnapshot)
  }

  const refreshTracker = async (trackerId: string): Promise<void> => {
    setRefreshingTrackerIds((currentIds) => {
      return [...currentIds, trackerId]
    })

    await usageClientService.refreshTracker({ trackerId })

    setRefreshingTrackerIds((currentIds) => {
      return currentIds.filter((currentId) => {
        return currentId !== trackerId
      })
    })
  }

  const toggleTrackerAutoRefresh = async (params: {
    isAutoRefreshPaused: boolean
    trackerId: string
  }): Promise<void> => {
    const nextSettings = await usageClientService.setTrackerPaused({
      isAutoRefreshPaused: !params.isAutoRefreshPaused,
      trackerId: params.trackerId,
    })

    setSettings(nextSettings)
  }

  useEffect(() => {
    const unsubscribe = usageClientService.subscribeToUsageUpdates({
      onUpdate: (updatedSnapshot) => {
        setSnapshot(updatedSnapshot)
      },
    })

    void loadSnapshot()

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [])

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowMs(Date.now())
    }, NOW_TICK_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [])

  const hasSnapshot = snapshot !== undefined
  const isEmpty = settings?.trackers.length === 0
  const providerSnapshots = snapshot?.providers ?? []

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Usage</h1>
          <p className="dashboard-subtitle">Track usage limits for your coding plans</p>
        </div>
        <div className="dashboard-actions">
          <DashboardAddButton
            label="Add tracker"
            onClick={() => {
              setIsAddOpen(true)
            }}
          />
        </div>
      </header>
      <main className="dashboard-grid">
        {providerSnapshots.map((providerSnapshot) => {
          const trackerConfig = settings?.trackers.find((tracker) => {
            return tracker.id === providerSnapshot.trackerId
          })

          return (
            <ProviderUsageCard
              key={providerSnapshot.trackerId}
              isAutoRefreshPaused={trackerConfig?.isAutoRefreshPaused ?? false}
              nowMs={nowMs}
              onOpenSettings={() => {
                setOpenTrackerId(providerSnapshot.trackerId)
              }}
              onRefresh={() => {
                void refreshTracker(providerSnapshot.trackerId)
              }}
              onToggleAutoRefresh={() => {
                void toggleTrackerAutoRefresh({
                  isAutoRefreshPaused: trackerConfig?.isAutoRefreshPaused ?? false,
                  trackerId: providerSnapshot.trackerId,
                })
              }}
              providerSnapshot={providerSnapshot}
              refreshIntervalMs={trackerConfig?.refreshIntervalMs}
              isRefreshing={refreshingTrackerIds.includes(providerSnapshot.trackerId)}
            />
          )
        })}
        {!hasSnapshot && !isEmpty && <p className="dashboard-empty">Loading usage…</p>}
        {isEmpty && (
          <div className="dashboard-empty-state">
            <p className="dashboard-empty">No trackers yet. Add one to start monitoring usage.</p>
            <button
              className="button button-primary"
              onClick={() => {
                setIsAddOpen(true)
              }}
              type="button"
            >
              Add tracker
            </button>
          </div>
        )}
      </main>
      {isAddOpen && (
        <AddTrackerDialog
          onClose={() => {
            setIsAddOpen(false)
          }}
          onSaved={() => {
            void loadSettings()
          }}
        />
      )}
      {openTrackerId !== undefined && (
        <TrackerSettingsDialog
          onClose={() => {
            setOpenTrackerId(undefined)
          }}
          onSaved={() => {
            void loadSettings()
          }}
          trackerId={openTrackerId}
        />
      )}
    </div>
  )
}
