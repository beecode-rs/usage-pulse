import type { ReactElement } from 'react'

export const UsageDashboardAddButton = (props: { label: string; onClick: () => void }): ReactElement => {
  const { label, onClick } = props

  return (
    <button aria-label={label} className="dashboard-add-button" onClick={onClick} title={label} type="button">
      <svg
        fill="none"
        height="16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="16"
      >
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </button>
  )
}
