import type { ReactElement } from 'react'

export const SchedulingClearRunsDialog = (props: { onClose: () => void; onConfirm: () => void }): ReactElement => {
  const { onClose, onConfirm } = props

  return (
    <div className="settings-overlay">
      <section className="settings-panel">
        <header className="settings-panel-header">
          <h2 className="settings-panel-title">Clear run logs</h2>
          <button className="button" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <p className="settings-hint">
          Are you sure you want to delete the run logs for this trigger? This cannot be undone.
        </p>
        <div className="settings-dialog-actions">
          <button className="button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button button-danger" onClick={onConfirm} type="button">
            Clear logs
          </button>
        </div>
      </section>
    </div>
  )
}
