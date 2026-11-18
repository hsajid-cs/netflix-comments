import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Comment } from '../types'
import { ChevronDownIcon, HeartIcon, MoreIcon, PencilIcon, PlayIcon, ReplyIcon, ThumbsDownIcon, TrashIcon } from './icons.js'
import { avatarColor } from '../avatar-color.js'
import { formatVideoTime } from '../format-time.js'
import { containsComment } from '../comment-order.js'
import { hideFutureComment } from '../discussion-scope.js'

// Direct replies beyond this are folded behind a "view replies" toggle so a
// hot thread doesn't bury the rest of the discussion.
const COLLAPSE_REPLIES_OVER = 4
// Visual indentation stops deepening past this level (threads stay readable in
// a ~380px panel however deep the nesting goes).
const MAX_VISUAL_DEPTH = 4
const MAX_LENGTH = 2000

function formatRelativeTime(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const sec = Math.max(0, Math.round(diffMs / 1000))
  if (sec < 45) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  const wk = Math.round(day / 7)
  if (wk < 5) return `${wk}w ago`
  const mo = Math.round(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.round(day / 365)}y ago`
}

function absoluteTime(createdAt: string): string {
  const d = new Date(createdAt)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

export default function CommentItem({
  comment,
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
  depth = 0,
}: {
  comment: Comment
  isAuthenticated: boolean
  /** The signed-in user's id, or null. Used to show Edit/Delete only on one's own comments. */
  currentUserId?: string | null
  newCommentId: string | null
  /** Id of a comment the panel wants scrolled into view (e.g. "jump to my spot"). */
  scrollToId?: string | null
  /** Live playback position in seconds, or null. Drives the spoiler blur. */
  currentVideoTime?: number | null
  onToggleLike: (id: string) => void
  onToggleDisagree: (id: string) => void
  onReply: (commentId: string, username: string) => void
  /** Save an edit to one's own comment. Rejects on failure (panel shows the error). */
  onEdit: (id: string, text: string) => Promise<void>
  /** Delete one's own comment. Rejects on failure. */
  onDelete: (id: string) => Promise<void>
  /** Seek the Netflix player to a comment's timestamp. Absent when not on a /watch page. */
  onSeek?: (seconds: number) => void
  depth?: number
}) {
  const isReply = depth > 0
  const isNew = comment.id === newCommentId
  const isDeleted = comment.deletedAt != null
  const isOwn = currentUserId != null && comment.userId === currentUserId && !isDeleted
  const ref = useRef<HTMLLIElement>(null)

  const replies = comment.replies
  const collapsible = !isReply && replies.length > COLLAPSE_REPLIES_OVER
  const [expanded, setExpanded] = useState(false)
  // Always reveal the thread if this client just added a reply into it.
  const containsNew = newCommentId != null && replies.some((r) => containsComment(r, newCommentId))
  const showReplies = !collapsible || expanded || containsNew

  // Inline edit / delete-confirm state (own comments only).
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.text)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const editRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isNew) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [isNew])

  // Grow the edit textarea with its content, and focus it when editing opens.
  useLayoutEffect(() => {
    const el = editRef.current
    if (!editing || !el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editing, draft])

  useEffect(() => {
    if (editing) {
      const el = editRef.current
      el?.focus()
      el?.setSelectionRange(el.value.length, el.value.length)
    }
  }, [editing])

  // Keep the whole thread masked, including replies, until its moment is reached.
  const isSpoiler = hideFutureComment(comment.videoTimeSeconds, currentVideoTime)
  const [revealed, setRevealed] = useState(false)
  const spoilerHidden = isSpoiler && !revealed

  const isScrollTarget = scrollToId != null && comment.id === scrollToId
  useEffect(() => {
    if (isScrollTarget) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [isScrollTarget])

  const likeLabel = `${comment.likedByMe ? 'Unlike' : 'Like'} comment by ${comment.username}${
    comment.likeCount > 0 ? `, ${comment.likeCount} like${comment.likeCount === 1 ? '' : 's'}` : ''
  }`

  const trimmedDraft = draft.trim()
  const canSave = !!trimmedDraft && trimmedDraft.length <= MAX_LENGTH && trimmedDraft !== comment.text && !saving

  function startEditing() {
    setConfirmingDelete(false)
    setDraft(comment.text)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setDraft(comment.text)
  }

  async function saveEdit() {
    if (!canSave) return
    setSaving(true)
    try {
      await onEdit(comment.id, trimmedDraft)
      setEditing(false)
    } catch {
      // The panel surfaces the error; keep the editor open so the user can retry.
    } finally {
      setSaving(false)
    }
  }

  function handleEditKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void saveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cancelEditing()
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await onDelete(comment.id)
      // On success this node is either removed or re-rendered as a tombstone by
      // the parent; nothing more to do here.
    } catch {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  const repliesBlock = replies.length > 0 && (
    <>
      {collapsible && (
        <button
          type="button"
          className="nc-replies-toggle"
          aria-expanded={showReplies}
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDownIcon width={14} height={14} className="nc-replies-toggle-chevron" />
          {showReplies ? 'Hide replies' : `View ${replies.length} replies`}
        </button>
      )}
      {showReplies && (
        <ul className="nc-comment-replies">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
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
              depth={Math.min(depth + 1, MAX_VISUAL_DEPTH)}
            />
          ))}
        </ul>
      )}
    </>
  )

  if (isDeleted) {
    return (
      <li
        ref={ref}
        className={`nc-comment nc-comment--deleted${isReply ? ' nc-comment--reply' : ''}`}
      >
        <div className="nc-comment-avatar" aria-hidden="true">
          —
        </div>
        <div className="nc-comment-body">
          <p className="nc-comment-text nc-comment-text--deleted">This comment was deleted.</p>
          {spoilerHidden && (
            <button type="button" className="nc-spoiler-reveal" onClick={() => setRevealed(true)}>
              Replies from a later moment — show anyway
            </button>
          )}
          {!spoilerHidden && repliesBlock}
        </div>
      </li>
    )
  }

  return (
    <li
      ref={ref}
      className={`nc-comment${isReply ? ' nc-comment--reply' : ''}${isNew ? ' nc-comment--new nc-comment--enter' : ''}${spoilerHidden ? ' nc-comment--spoiler' : ''}`}
    >
      <div className="nc-comment-avatar" style={{ backgroundColor: avatarColor(comment.username) }} aria-hidden="true">
        {initials(comment.username)}
      </div>
      <div className="nc-comment-body">
        <div className="nc-comment-meta">
          <span className="nc-comment-author">{comment.username}</span>
          {isOwn && <span className="nc-comment-you">you</span>}
          <span className="nc-comment-time" title={absoluteTime(comment.createdAt)}>
            {formatRelativeTime(comment.createdAt)}
          </span>
          {comment.editedAt != null && (
            <span className="nc-comment-edited" title={`Edited ${absoluteTime(comment.editedAt)}`}>
              edited
            </span>
          )}
          {comment.videoTimeSeconds != null && onSeek && (
            <button
              type="button"
              className="nc-ts-badge"
              onClick={() => onSeek(comment.videoTimeSeconds!)}
              title={`Jump the player to ${formatVideoTime(comment.videoTimeSeconds)}`}
              aria-label={`Jump the player to ${formatVideoTime(comment.videoTimeSeconds)}`}
            >
              <PlayIcon width={9} height={9} /> {formatVideoTime(comment.videoTimeSeconds)}
            </button>
          )}
        </div>

        {editing && !spoilerHidden ? (
          <div className="nc-comment-edit">
            <textarea
              ref={editRef}
              className="nc-comment-edit-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={1}
              maxLength={MAX_LENGTH + 500}
              disabled={saving}
              aria-label="Edit your comment"
            />
            <div className="nc-comment-edit-actions">
              <button type="button" className="nc-post-btn" onClick={saveEdit} disabled={!canSave}>
                {saving && <span className="nc-spinner" aria-hidden="true" />}
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="nc-action-btn" onClick={cancelEditing} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        ) : spoilerHidden ? (
          <div className="nc-spoiler">
            <p className="nc-comment-text nc-comment-text--spoiler" aria-hidden="true">
              Comment hidden until this moment.
            </p>
            <button
              type="button"
              className="nc-spoiler-reveal"
              onClick={() => setRevealed(true)}
              aria-label={`Show comment from ${
                comment.videoTimeSeconds != null ? formatVideoTime(comment.videoTimeSeconds) : 'a later moment'
              } (spoiler — you haven't reached this point)`}
            >
              <span aria-hidden="true">⚠</span> Spoiler from a later moment — show anyway
            </button>
          </div>
        ) : (
          <p className="nc-comment-text">{comment.text}</p>
        )}

        {!editing && !spoilerHidden && confirmingDelete ? (
          <div className="nc-comment-actions nc-comment-confirm" role="group" aria-label="Confirm delete">
            <span className="nc-comment-confirm-text">Delete this comment?</span>
            <button
              type="button"
              className="nc-action-btn nc-action-btn--danger"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              className="nc-action-btn"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              Cancel
            </button>
          </div>
        ) : (
          !editing && !spoilerHidden && (
            <div className="nc-comment-actions">
              <button
                type="button"
                className={`nc-action-btn nc-action-btn--like${comment.likedByMe ? ' nc-action-btn--active' : ''}`}
                onClick={() => onToggleLike(comment.id)}
                disabled={!isAuthenticated}
                title={isAuthenticated ? undefined : 'Log in to like comments'}
                aria-pressed={comment.likedByMe}
                aria-label={likeLabel}
              >
                <span className="nc-like-icon">
                  <HeartIcon filled={comment.likedByMe} width={14} height={14} />
                </span>
                {comment.likeCount > 0 && comment.likeCount}
              </button>
              <button
                type="button"
                className={`nc-action-btn nc-action-btn--disagree${comment.disagreedByMe ? ' nc-action-btn--active' : ''}`}
                onClick={() => onToggleDisagree(comment.id)}
                disabled={!isAuthenticated}
                title={isAuthenticated ? (comment.disagreedByMe ? 'Remove disagreement' : 'Disagree') : 'Log in to disagree'}
                aria-pressed={comment.disagreedByMe}
                aria-label={`${comment.disagreedByMe ? 'Remove disagreement with' : 'Disagree with'} comment by ${comment.username}`}
              >
                <ThumbsDownIcon width={14} height={14} />
                {comment.disagreeCount > 0 && comment.disagreeCount}
              </button>
              {isAuthenticated && (
                <button
                  type="button"
                  className="nc-action-btn"
                  onClick={() => onReply(comment.id, comment.username)}
                >
                  <ReplyIcon width={14} height={14} />
                  Reply
                </button>
              )}
              {isOwn && (
                <details className="nc-comment-menu">
                  <summary aria-label="More actions for your comment" title="More actions"><MoreIcon width={15} height={15} /></summary>
                  <div className="nc-comment-menu-items">
                    <button type="button" className="nc-action-btn" onClick={startEditing}>
                      <PencilIcon width={14} height={14} />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="nc-action-btn nc-action-btn--danger"
                      onClick={() => setConfirmingDelete(true)}
                    >
                      <TrashIcon width={14} height={14} />
                      Delete
                    </button>
                  </div>
                </details>
              )}
            </div>
          )
        )}

        {!spoilerHidden && repliesBlock}
      </div>
    </li>
  )
}
