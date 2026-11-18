import type { ReactNode } from 'react'

/**
 * Shared presentational shell for every non-list panel body state (empty,
 * error, title-not-detected, offline). Keeps icon size, spacing, and the
 * optional call-to-action visually identical across all of them.
 */
export default function PanelMessage({
  icon,
  tone = 'default',
  title,
  children,
  action,
}: {
  icon: ReactNode
  tone?: 'default' | 'danger'
  title: string
  children?: ReactNode
  action?: { label: string; onClick: () => void; variant?: 'solid' | 'ghost'; icon?: ReactNode }
}) {
  return (
    <div className="nc-state" role="group" aria-label={title}>
      <div className={`nc-state-icon${tone === 'danger' ? ' nc-state-icon--danger' : ''}`}>{icon}</div>
      <p className="nc-state-title">{title}</p>
      {children && <p className="nc-state-subtitle">{children}</p>}
      {action && (
        <button
          type="button"
          className={`nc-state-action${action.variant === 'ghost' ? ' nc-state-action--ghost' : ''}`}
          onClick={action.onClick}
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  )
}
