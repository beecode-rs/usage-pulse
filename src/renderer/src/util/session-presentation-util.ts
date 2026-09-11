import { dateUtil } from '#src/renderer/src/util/date-util'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'

export const sessionPresentationUtil = {
  resolveLastActivityLabel: (params: { lastActivityAt: number; nowMs: number }): string => {
    return `active ${dateUtil.formatDuration(params.nowMs - params.lastActivityAt)} ago`
  },

  resolveModelLabel: (params: { model: string }): string => {
    return params.model.replace(/-\d{8}$/, '')
  },

  resolveProjectLabel: (params: { cwd: string }): string => {
    const segments = params.cwd.split('/').filter((segment) => {
      return segment !== ''
    })
    const lastSegment = segments.at(-1)

    if (lastSegment === undefined) {
      return params.cwd
    }

    return lastSegment
  },

  resolveSessionTitle: (params: { session: SessionInfo }): string => {
    if (params.session.name !== '') {
      return params.session.name
    }

    if (params.session.transcript?.aiTitle !== undefined && params.session.transcript.aiTitle !== '') {
      return params.session.transcript.aiTitle
    }

    if (params.session.cwd !== '') {
      return sessionPresentationUtil.resolveProjectLabel({ cwd: params.session.cwd })
    }

    return 'Unnamed session'
  },

  resolveSessionTitleParts: (params: { title: string }): { name: string; suffix: string | undefined } => {
    const titleMatch = /^(.+)-(.+)$/.exec(params.title)
    const name = titleMatch?.[1]
    const suffix = titleMatch?.[2]

    if (name === undefined || suffix === undefined) {
      return { name: params.title, suffix: undefined }
    }

    return { name, suffix }
  },

  resolveStatusPresentation: (params: {
    status: SessionStatusMapper
  }): { badgeClassName: string; dotClassName: string; label: string } => {
    switch (params.status) {
      case SessionStatusMapper.BUSY: {
        return {
          badgeClassName: 'session-status is-busy',
          dotClassName: 'session-status-dot is-busy',
          label: 'Working',
        }
      }

      case SessionStatusMapper.IDLE: {
        return { badgeClassName: 'session-status is-idle', dotClassName: 'session-status-dot is-idle', label: 'Idle' }
      }

      case SessionStatusMapper.WAITING: {
        return {
          badgeClassName: 'session-status is-waiting',
          dotClassName: 'session-status-dot is-waiting',
          label: 'Waiting for input',
        }
      }

      default: {
        return {
          badgeClassName: 'session-status is-unknown',
          dotClassName: 'session-status-dot is-unknown',
          label: 'Unknown',
        }
      }
    }
  },

  resolveTokenCountLabel: (params: { count: number }): string => {
    if (params.count < 1000) {
      return String(params.count)
    }

    if (params.count < 100_000) {
      return `${String(Math.round(params.count / 100) / 10)}k`
    }

    if (params.count < 1_000_000) {
      return `${String(Math.round(params.count / 1000))}k`
    }

    return `${String(Math.round(params.count / 100_000) / 10)}M`
  },
}
