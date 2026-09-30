import { type SessionInfo, type SessionSnapshot } from '#src/shared/business/model/session-model'
import { type UsageSnapshot } from '#src/shared/business/model/usage-model'

export enum UsageWarningReason {
  HIGH_USAGE = 'high-usage',
  LIMIT_REACHED = 'limit-reached',
  PROVIDER_ERROR = 'provider-error',
}

export type UsageWarning = {
  errorMessage?: string
  reason: UsageWarningReason
  trackerId: string
  trackerName: string
  usedPercent?: number
  windowLabel?: string
}

export type MobileStateMessage = {
  sessions: SessionSnapshot | null
  type: 'state'
  usage: UsageSnapshot
}

export type MobileUsageSnapshotMessage = {
  type: 'usage-snapshot'
  usage: UsageSnapshot
}

export type MobileSessionsSnapshotMessage = {
  sessions: SessionSnapshot
  type: 'sessions-snapshot'
}

export type MobileSessionFinishedMessage = {
  session: SessionInfo
  type: 'session-finished'
}

export type MobileUsageWarningMessage = {
  type: 'usage-warning'
  warning: UsageWarning
}

export type MobileHeartbeatMessage = {
  at: number
  type: 'heartbeat'
}

export type MobileWsMessage =
  | MobileHeartbeatMessage
  | MobileSessionFinishedMessage
  | MobileSessionsSnapshotMessage
  | MobileStateMessage
  | MobileUsageSnapshotMessage
  | MobileUsageWarningMessage

export type MobileConnectedDevice = {
  address: string
  connectedAt: number
  id: string
  userAgent: string
}

export type MobileDevicesUpdateListener = (devices: MobileConnectedDevice[]) => void

export type MobileHealthResponse = {
  appVersion: string
  ok: boolean
}

export type MobileStateResponse = {
  sessions: SessionSnapshot | null
  usage: UsageSnapshot
}
