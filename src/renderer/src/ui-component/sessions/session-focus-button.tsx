import type { ReactElement } from 'react'

export const SessionsSessionFocusButton = (props: { label: string; onClick: () => void }): ReactElement => {
  const { label, onClick } = props

  return (
    <button aria-label={label} className="session-focus-button" onClick={onClick} title={label} type="button">
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
        <circle cx="12" cy="12" r="3" />
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      </svg>
    </button>
  )
}
