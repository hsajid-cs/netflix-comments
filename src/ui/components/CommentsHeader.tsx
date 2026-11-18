import { CloseIcon, ExpandIcon, MinimizeIcon } from './icons'

function formatCount(n: number): string {
  if (n < 1000) return String(n)
  const k = n / 1000
  return `${k >= 10 || Number.isInteger(k) ? Math.round(k) : k.toFixed(1)}k`
}

export default function CommentsHeader({
  headingId,
  titleName,
  commentCount,
  contextLabel,
  isMinimized,
  onToggleMinimize,
  onClose,
}: {
  /** Heading `id`, so the panel can be `aria-labelledby` it. */
  headingId: string
  titleName: string | null
  commentCount: number
  contextLabel: string
  isMinimized: boolean
  onToggleMinimize: () => void
  onClose: () => void
}) {
  return (
    <div className="nc-header">
      <div className="nc-title-mark" aria-hidden="true">
        {(titleName ?? 'NC').split(/\s+/).filter((word) => !['the', 'a', 'an'].includes(word.toLowerCase())).map((word) => word[0]).slice(0, 2).join('').toUpperCase() || 'NC'}
      </div>
      <div className="nc-header-text">
        <h2 className="nc-header-title" id={headingId}>
          {titleName ?? 'This title'}
        </h2>
        <span className="nc-header-subtitle">
          <span className="nc-header-count">
            {formatCount(commentCount)} {commentCount === 1 ? 'comment' : 'comments'}
          </span>
          <span className="nc-header-dot" aria-hidden="true">·</span>
          <span className="nc-header-user">{contextLabel}</span>
        </span>
      </div>
      <div className="nc-header-controls">
        <button
          type="button"
          className="nc-icon-btn nc-header-btn"
          onClick={onToggleMinimize}
          aria-label={isMinimized ? 'Expand comments panel' : 'Minimize comments panel'}
          aria-expanded={!isMinimized}
          title={isMinimized ? 'Expand' : 'Minimize'}
        >
          {isMinimized ? <ExpandIcon /> : <MinimizeIcon />}
        </button>
        <button
          type="button"
          className="nc-icon-btn nc-header-btn"
          onClick={onClose}
          aria-label="Close comments panel"
          title="Close"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
