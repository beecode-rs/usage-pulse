import { type ReactElement } from 'react'

export const DashboardEmptyBox = (props: { label: string; onOpen: () => void; title: string }): ReactElement => {
  const { label, onOpen, title } = props

  return (
    <button className="dashboard-empty-box" onClick={onOpen} type="button">
      <span aria-hidden="true" className="dashboard-empty-box-icon">
        <svg
          fill="none"
          height="18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="18"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </span>
      <span className="dashboard-empty-box-title">{title}</span>
      <span className="dashboard-empty-box-label">{label}</span>
    </button>
  )
}
