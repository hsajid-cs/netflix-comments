/**
 * Skeleton that mirrors the real comment row layout (avatar + author line +
 * text lines) so the transition to loaded content doesn't shift. Shimmer
 * rather than a bare opacity pulse; announced once via a polite live region.
 */
export default function LoadingState() {
  return (
    <div className="nc-skeleton" role="status" aria-live="polite">
      {[0, 1, 2, 3].map((row) => (
        <div className="nc-skel-row" key={row}>
          <div className="nc-skel-avatar" />
          <div className="nc-skel-lines">
            <div className="nc-skel-line nc-skel-line--sm" />
            <div className="nc-skel-line nc-skel-line--lg" />
            <div className="nc-skel-line nc-skel-line--md" />
          </div>
        </div>
      ))}
      <span className="nc-visually-hidden">Loading comments…</span>
    </div>
  )
}
