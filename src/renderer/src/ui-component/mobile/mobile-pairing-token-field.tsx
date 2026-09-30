import { type ReactElement, useState } from 'react'

const COPIED_RESET_MS = 2000

const renderCopyIcon = (): ReactElement => {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="14"
    >
      <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

const renderRegenerateIcon = (): ReactElement => {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="14"
    >
      <polyline points="1 20 1 14 7 14" />
      <polyline points="23 4 23 10 17 10" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

const renderShowIcon = (): ReactElement => {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="14"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

const renderHideIcon = (): ReactElement => {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="14"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" x2="23" y1="1" y2="23" />
    </svg>
  )
}

export const MobilePairingTokenField = (props: { onRegenerateToken: () => void; token: string }): ReactElement => {
  const { onRegenerateToken, token } = props
  const [isCopied, setIsCopied] = useState(false)
  const [isTokenVisible, setIsTokenVisible] = useState(false)

  const handleToggleVisibility = (): void => {
    setIsTokenVisible(!isTokenVisible)
  }

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(token)
    } catch {
      return
    }

    setIsCopied(true)
    setTimeout(() => {
      setIsCopied(false)
    }, COPIED_RESET_MS)
  }

  const resolveCopyTitle = (): string => {
    if (isCopied) {
      return 'Copied'
    }

    return 'Copy pairing token'
  }

  const resolveTokenDisplay = (): string => {
    if (isTokenVisible) {
      return token
    }

    return '***'
  }

  const resolveTokenTitle = (): string | undefined => {
    if (isTokenVisible) {
      return token
    }

    return undefined
  }

  const resolveVisibilityIcon = (): ReactElement => {
    if (isTokenVisible) {
      return renderHideIcon()
    }

    return renderShowIcon()
  }

  const resolveVisibilityTitle = (): string => {
    if (isTokenVisible) {
      return 'Hide pairing token'
    }

    return 'Show pairing token'
  }

  return (
    <div className="settings-field">
      <span className="settings-field-label">Pairing token</span>
      <div className="mobile-token-row">
        <input
          aria-label="Pairing token"
          className="mobile-token-value"
          readOnly
          spellCheck={false}
          title={resolveTokenTitle()}
          value={resolveTokenDisplay()}
        />
        <button
          aria-label={resolveVisibilityTitle()}
          className="button"
          onClick={handleToggleVisibility}
          title={resolveVisibilityTitle()}
          type="button"
        >
          {resolveVisibilityIcon()}
        </button>
        <button
          aria-label={resolveCopyTitle()}
          className="button"
          onClick={() => {
            void handleCopy()
          }}
          title={resolveCopyTitle()}
          type="button"
        >
          {renderCopyIcon()}
        </button>
        <button className="button" onClick={onRegenerateToken} type="button">
          {renderRegenerateIcon()}
          Regenerate
        </button>
      </div>
      <span className="settings-hint">
        Authenticates the mobile app. Regenerating invalidates the old token on the next connection.
      </span>
    </div>
  )
}
