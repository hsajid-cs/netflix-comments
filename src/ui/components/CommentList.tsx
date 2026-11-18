import { useEffect, useMemo, useRef, useState } from 'react'
import type { Comment } from '../types'
import CommentItem from './CommentItem'
import { containsComment } from '../comment-order'

// Render top-level comments in batches. Threads with thousands of comments stay
// responsive because only a window is ever in the DOM; the rest stream in as
// the user scrolls (or via the explicit button, for keyboard users).
const INITIAL_BATCH = 25
const NEXT_BATCH = 25

export default function CommentList({
  comments,
  isAuthenticated,
  currentUserId = null,
  newCommentId,
  scrollToId = null,
  currentVideoTime = null,
  onToggleLike,
  onToggleDisagree,
  onReply,
  onEdit,
  onDelete,
  onSeek,
}: {
  comments: Comment[]
  isAuthenticated: boolean
  /** The signed-in user's id, or null. Threaded down so Edit/Delete show only on own comments. */
  currentUserId?: string | null
  newCommentId: string | null
  scrollToId?: string | null
  /** Live playback position, or null. Passed through to each item's spoiler guard. */
  currentVideoTime?: number | null
  onToggleLike: (id: string) => void
  onToggleDisagree: (id: string) => void
  onReply: (commentId: string, username: string) => void
  onEdit: (id: string, text: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSeek?: (seconds: number) => void
}) {
  const [visible, setVisible] = useState(INITIAL_BATCH)
  const sentinelRef = useRef<HTMLLIElement>(null)

  const hasMore = visible < comments.length

  // Keep a targeted root comment in view even if it lands past the window:
  // a just-posted comment, or one the panel asked us to scroll to ("jump to my spot").
  useEffect(() => {
    const targetId = newCommentId ?? scrollToId
    if (!targetId) return
    const idx = comments.findIndex((c) => containsComment(c, targetId))
    if (idx >= 0 && idx >= visible) setVisible(idx + 1)
  }, [newCommentId, scrollToId, comments, visible])

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible((v) => v + NEXT_BATCH)
      },
      { rootMargin: '400px 0px' },
    )
    io.observe(sentinelRef.current)
    return () => io.disconnect()
  }, [hasMore])

  const shown = useMemo(() => comments.slice(0, visible), [comments, visible])

  return (
    <ul className="nc-comment-list">
      {shown.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          isAuthenticated={isAuthenticated}
          currentUserId={currentUserId}
          newCommentId={newCommentId}
          scrollToId={scrollToId}
          currentVideoTime={currentVideoTime}
          onToggleLike={onToggleLike}
          onToggleDisagree={onToggleDisagree}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onSeek={onSeek}
        />
      ))}
      {hasMore && (
        <li ref={sentinelRef}>
          <button type="button" className="nc-show-more" onClick={() => setVisible((v) => v + NEXT_BATCH)}>
            Show {Math.min(NEXT_BATCH, comments.length - visible)} more
            {comments.length - visible > NEXT_BATCH ? ` of ${comments.length - visible}` : ''}
          </button>
        </li>
      )}
    </ul>
  )
}
