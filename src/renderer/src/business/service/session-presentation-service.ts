import { typeUtil } from '@beecode/msh-util'

import { constant } from '#src/renderer/src/util/constant'
import { dateUtil } from '#src/renderer/src/util/date-util'
import { SessionProviderMapper } from '#src/shared/business/enum/session-provider-mapper-enum'
import { SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'

export const sessionPresentationService = {
  resolveLastActivityLabel: (params: { lastActivityAt: number; nowMs: number }): string => {
    const { lastActivityAt, nowMs } = params

    return `active ${dateUtil.formatDuration(nowMs - lastActivityAt)} ago`
  },

  resolveModelLabel: (params: { model: string }): string => {
    const { model } = params

    return model.replace(constant.regex.modelDateSuffixRegex, '')
  },

  resolveProjectLabel: (params: { cwd: string }): string => {
    const { cwd } = params
    const segments = cwd.split('/').filter((segment) => {
      return segment !== ''
    })
    const lastSegment = segments.at(-1)

    if (lastSegment === undefined) {
      return cwd
    }

    return lastSegment
  },

  resolveProviderLabel: (params: { provider: SessionProviderMapper }): string => {
    const { provider } = params
    switch (provider) {
      case SessionProviderMapper.CLAUDE_CODE: {
        return 'Claude Code'
      }

      case SessionProviderMapper.OPENCODE: {
        return 'OpenCode'
      }

      default: {
        throw typeUtil.exhaustiveError('unsupported session provider [provider]', provider)
      }
    }
  },

  resolveSessionKey: (params: { session: SessionInfo }): string => {
    const { session } = params
    const hostId = session.hostId ?? 'local'

    if (session.pid === undefined) {
      return `${hostId}:${session.provider}:${session.sessionId}:x`
    }

    return `${hostId}:${session.provider}:${session.sessionId}:${String(session.pid)}`
  },

  resolveSessionTitle: (params: { session: SessionInfo }): string => {
    const { session } = params
    if (session.name !== '') {
      return session.name
    }

    if (session.transcript?.aiTitle !== undefined && session.transcript.aiTitle !== '') {
      return session.transcript.aiTitle
    }

    if (session.cwd !== '') {
      return sessionPresentationService.resolveProjectLabel({ cwd: session.cwd })
    }

    return 'Unnamed session'
  },

  resolveSessionTitleParts: (params: { title: string }): { name: string; suffix: string | undefined } => {
    const { title } = params
    const titleMatch = constant.regex.titleHyphenSplitRegex.exec(title)
    const name = titleMatch?.[1]
    const suffix = titleMatch?.[2]

    if (name === undefined || suffix === undefined) {
      return { name: title, suffix: undefined }
    }

    return { name, suffix }
  },

  resolveStatusPresentation: (params: {
    status: SessionStatusMapper
  }): { badgeClassName: string; dotClassName: string; label: string } => {
    const { status } = params
    switch (status) {
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

      case SessionStatusMapper.UNKNOWN: {
        return {
          badgeClassName: 'session-status is-unknown',
          dotClassName: 'session-status-dot is-unknown',
          label: 'Unknown',
        }
      }

      case SessionStatusMapper.WAITING: {
        return {
          badgeClassName: 'session-status is-waiting',
          dotClassName: 'session-status-dot is-waiting',
          label: 'Waiting for input',
        }
      }

      default: {
        throw typeUtil.exhaustiveError('unsupported session status [status]', status)
      }
    }
  },

  resolveTokenCountLabel: (params: { count: number }): string => {
    const { count } = params
    if (count < 1000) {
      return String(count)
    }

    if (count < 100_000) {
      return `${String(Math.round(count / 100) / 10)}k`
    }

    if (count < 1_000_000) {
      return `${String(Math.round(count / 1000))}k`
    }

    return `${String(Math.round(count / 100_000) / 10)}M`
  },
}
