import { type ReactElement, useEffect, useState } from 'react'

import { sessionsClientService } from '#src/renderer/src/business/service/sessions-client-service'
import { usageClientService } from '#src/renderer/src/business/service/usage-client-service'
import { errorUtil } from '#src/renderer/src/util/error-util'
import { type AppSettings, type SshHostConfig } from '#src/shared/business/model/settings-model'

const resolveTestMessageClassName = (hasError: boolean): string => {
  if (hasError) {
    return 'ssh-host-test-message is-error'
  }

  return 'ssh-host-test-message'
}

const renderCloseIcon = (): ReactElement => {
  return (
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

const renderTestIcon = (): ReactElement => {
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
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

const renderAddIcon = (): ReactElement => {
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

const renderRemoveIcon = (): ReactElement => {
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
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  )
}

export const SshHostsDialog = (props: { onClose: () => void; onSaved: () => void }): ReactElement => {
  const { onClose, onSaved } = props
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined)
  const [urlDraft, setUrlDraft] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [hasTestError, setHasTestError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | undefined>(undefined)

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      const loadedSettings = await usageClientService.getSettings()

      setSettings(loadedSettings)
    }

    void loadSettings()
  }, [])

  const persistSshHosts = async (params: { sshHosts: SshHostConfig[] }): Promise<boolean> => {
    const { sshHosts } = params

    if (settings === undefined) {
      return false
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      const nextSettings = await usageClientService.saveSettings({
        settings: { ...settings, sshHosts },
      })

      setSettings(nextSettings)
      setConfirmingRemoveId(undefined)
      onSaved()

      return true
    } catch (error) {
      setErrorMessage(errorUtil.resolveMessage(error))

      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleAdd = async (): Promise<void> => {
    if (settings === undefined) {
      return
    }

    const url = urlDraft.trim()

    if (url === '') {
      setErrorMessage('Enter an ssh host url to add it.')

      return
    }

    const sshHost: SshHostConfig = { id: crypto.randomUUID(), isEnabled: true, url }
    const hasSaved = await persistSshHosts({ sshHosts: [...settings.sshHosts, sshHost] })

    if (hasSaved) {
      setUrlDraft('')
    }
  }

  const handleTest = async (): Promise<void> => {
    const url = urlDraft.trim()

    if (url === '') {
      setErrorMessage('Enter an ssh host url to test it.')

      return
    }

    setIsTesting(true)
    setTestMessage('')
    setErrorMessage('')

    try {
      await sessionsClientService.testSshHost({ url })

      setTestMessage('Connected.')
      setHasTestError(false)
    } catch (error) {
      setTestMessage(errorUtil.resolveMessage(error))
      setHasTestError(true)
    } finally {
      setIsTesting(false)
    }
  }

  const handleToggleEnabled = async (params: { host: SshHostConfig }): Promise<void> => {
    const { host } = params

    if (settings === undefined) {
      return
    }

    const nextSshHosts = settings.sshHosts.map((sshHost) => {
      if (sshHost.id !== host.id) {
        return sshHost
      }

      return { ...sshHost, isEnabled: !sshHost.isEnabled }
    })

    await persistSshHosts({ sshHosts: nextSshHosts })
  }

  const handleRemove = async (params: { host: SshHostConfig }): Promise<void> => {
    const { host } = params

    if (settings === undefined) {
      return
    }

    if (confirmingRemoveId !== host.id) {
      setConfirmingRemoveId(host.id)

      return
    }

    const nextSshHosts = settings.sshHosts.filter((sshHost) => {
      return sshHost.id !== host.id
    })

    await persistSshHosts({ sshHosts: nextSshHosts })
  }

  const resolveRemoveLabel = (hostId: string): string => {
    if (confirmingRemoveId === hostId) {
      return 'Confirm remove'
    }

    return 'Remove'
  }

  if (settings === undefined) {
    return (
      <div className="settings-overlay">
        <section className="settings-panel">
          <p className="provider-card-message">Loading settings…</p>
        </section>
      </div>
    )
  }

  return (
    <div className="settings-overlay">
      <section className="settings-panel">
        <header className="settings-panel-header">
          <h2 className="settings-panel-title">SSH hosts</h2>
          <button aria-label="Close" className="sessions-close-button" onClick={onClose} title="Close" type="button">
            {renderCloseIcon()}
          </button>
        </header>
        {settings.sshHosts.length > 0 && (
          <div className="ssh-hosts-list">
            {settings.sshHosts.map((sshHost) => {
              return (
                <div className="ssh-host-row" key={sshHost.id}>
                  <span className="ssh-host-url" title={sshHost.url}>
                    {sshHost.url}
                  </span>
                  <label className="ssh-host-toggle">
                    <input
                      checked={sshHost.isEnabled}
                      disabled={isSaving}
                      onChange={() => {
                        void handleToggleEnabled({ host: sshHost })
                      }}
                      type="checkbox"
                    />
                    Enabled
                  </label>
                  <button
                    className="button button-danger"
                    disabled={isSaving}
                    onClick={() => {
                      void handleRemove({ host: sshHost })
                    }}
                    type="button"
                  >
                    {renderRemoveIcon()}
                    {resolveRemoveLabel(sshHost.id)}
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <label className="settings-field">
          <span className="settings-field-label">Host url</span>
          <input
            className="settings-field-input"
            onChange={(event) => {
              setUrlDraft(event.target.value)
            }}
            placeholder="box-1, user@host, user@host:2222, ssh://user@host:2222"
            type="text"
            value={urlDraft}
          />
        </label>
        <p className="settings-hint">Uses your existing SSH keys and ~/.ssh/config. Password auth is not supported.</p>
        {testMessage !== '' && <p className={resolveTestMessageClassName(hasTestError)}>{testMessage}</p>}
        {errorMessage !== '' && <p className="settings-error">{errorMessage}</p>}
        <div className="settings-dialog-actions">
          <button
            className="button"
            disabled={isTesting}
            onClick={() => {
              void handleTest()
            }}
            type="button"
          >
            {renderTestIcon()}
            Test
          </button>
          <button
            className="button button-primary"
            disabled={isSaving}
            onClick={() => {
              void handleAdd()
            }}
            type="button"
          >
            {renderAddIcon()}
            Add host
          </button>
        </div>
      </section>
    </div>
  )
}
