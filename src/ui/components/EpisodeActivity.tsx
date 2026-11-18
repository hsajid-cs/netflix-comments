import { useMemo } from 'react'
import type { Comment } from '../types'
import { commentActivity } from '../comment-activity'
import { formatVideoTime } from '../format-time'

export default function EpisodeActivity({ comments, duration, currentTime, onSeek }: {
  comments: Comment[]
  duration: number
  currentTime: number | null
  onSeek?: (seconds: number) => void
}) {
  const buckets = useMemo(() => commentActivity(comments, duration), [comments, duration])
  const peak = Math.max(1, ...buckets.map((bucket) => bucket.count))
  const progress = currentTime != null && Number.isFinite(currentTime) ? Math.max(0, Math.min(100, currentTime / duration * 100)) : null
  return (
    <div className="nc-activity">
      <div className="nc-activity-heading">
        <span>Comments across the episode</span>
        <span className="nc-activity-time">
          <strong>{currentTime != null && Number.isFinite(currentTime) ? formatVideoTime(currentTime) : '—'}</strong>
          <span> / {formatVideoTime(duration)}</span>
        </span>
      </div>
      <div className="nc-activity-bars" role="group" aria-label="Episode comment activity">
        {buckets.map((bucket, index) => {
          const height = `${bucket.count ? 7 + bucket.count / peak * 19 : 3}px`
          const played = progress != null && index / buckets.length * 100 < progress
          const className = `nc-activity-bar${played ? ' nc-activity-bar--played' : ''}`
          return bucket.seconds != null && onSeek ? (
            <button key={index} type="button" className={className} style={{ height }}
              title={`${bucket.count} ${bucket.count === 1 ? 'comment' : 'comments'} at ${formatVideoTime(bucket.seconds)}`}
              aria-label={`Jump to ${formatVideoTime(bucket.seconds)}, ${bucket.count} ${bucket.count === 1 ? 'comment' : 'comments'}`}
              onClick={() => onSeek(bucket.seconds!)} />
          ) : <span key={index} className={className} style={{ height }} aria-hidden="true" />
        })}
        {progress != null && <span className="nc-activity-cursor" style={{ left: `${progress}%` }} aria-hidden="true" />}
      </div>
    </div>
  )
}
