import { type ReactElement, useState } from 'react'

const COPIED_RESET_MS = 2000

export const MobilePairingTokenField = (props: { onRegenerateToken: () => void; token: string }): ReactElement => {
  const { onRegenerateToken, token } = props
  const [isCopied, setIsCopied] = useState(false)

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

  const resolveCopyLabel = (): string => {
    if (isCopied) {
      return 'Copied'
    }

    return 'Copy'
  }

  return (
    <div className="settings-field">
      <span className="settings-field-label">Pairing token</span>
      <div className="mobile-token-row">
        <code className="mobile-token-value" title={token}>
          {token}
        </code>
        <button
          className="button"
          onClick={() => {
            void handleCopy()
          }}
          type="button"
        >
          {resolveCopyLabel()}
        </button>
        <button className="button" onClick={onRegenerateToken} type="button">
          Regenerate
        </button>
      </div>
      <span className="settings-hint">
        Authenticates the mobile app. Regenerating invalidates the old token on the next connection.
      </span>
    </div>
  )
}
