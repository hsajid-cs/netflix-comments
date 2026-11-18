import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { ArrowUpIcon, ClockIcon, CloseIcon } from './icons'
import { formatVideoTime } from '../format-time'

const MAX_LENGTH = 2000
const COUNTER_VISIBLE_AT = MAX_LENGTH - 200

export default function CommentComposer({
  replyTo,
  currentUsername,
  focusToken = 0,
  captureTimestamp = false,
  getVideoTime,
  onCancelReply,
  onSubmit,
}: {
  replyTo: { id: string; username: string } | null
  currentUsername: string | null
  /** Bumped by the parent to pull focus into the field (panel opened, reply started). */
  focusToken?: number
  /** On a /watch page: offer to stamp the comment with the current playback position. */
  captureTimestamp?: boolean
  getVideoTime?: () => number | null
  onCancelReply: () => void
  onSubmit: (text: string, videoTimeSeconds?: number) => Promise<unknown>
}) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [attachTs, setAttachTs] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const submittingRef = useRef(false)

  // Auto-grow the textarea with its content, capped by max-height in CSS.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  // Focus when the parent asks (panel opened) or when a reply target appears.
  useEffect(() => {
    if (focusToken > 0) textareaRef.current?.focus()
  }, [focusToken])

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus()
  }, [replyTo])

  // Default the timestamp back on whenever we return to composing a top-level comment.
  useEffect(() => {
    if (!replyTo) setAttachTs(true)
  }, [replyTo])

  const trimmed = text.trim()
  const over = text.length > MAX_LENGTH
  const canSubmit = !!trimmed && !over && !submitting

  // A timestamp only applies to a top-level comment made on a /watch page.
  const showTimestamp = captureTimestamp && !replyTo
  const liveTime = showTimestamp && getVideoTime ? getVideoTime() : null

  async function submit() {
    if (!canSubmit || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const time = showTimestamp && attachTs ? getVideoTime?.() : null
      const stamp = time != null && Number.isFinite(time) && time >= 0 ? Math.floor(time) : undefined
      await onSubmit(trimmed, stamp)
      setText('') // only clear once the backend has confirmed the post
      setAttachTs(true)
    } catch {
      // Surfaced via the panel's action-error banner; keep the draft so the
      // user doesn't lose what they typed.
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void submit()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void submit()
    } else if (e.key === 'Escape' && replyTo) {
      e.preventDefault()
      e.stopPropagation()
      onCancelReply()
    }
  }

  const remaining = MAX_LENGTH - text.length

  return (
    <form className="nc-composer" onSubmit={handleSubmit} aria-label={currentUsername ? `Comment as ${currentUsername}` : 'Write a comment'}>
      <div className="nc-composer-card">
        {replyTo && (
          <div className="nc-reply-chip">
            <span>
              Replying to <span className="nc-reply-chip-target">@{replyTo.username}</span>
            </span>
            <button
              type="button"
              className="nc-reply-chip-close"
              onClick={onCancelReply}
              aria-label="Cancel reply"
            >
              <CloseIcon width={13} height={13} />
            </button>
          </div>
        )}

        <div className="nc-composer-field">
          <textarea
            ref={textareaRef}
            className="nc-composer-input"
            placeholder={replyTo ? `Reply to ${replyTo.username}…` : showTimestamp && liveTime != null ? `Add a thought at ${formatVideoTime(liveTime)}…` : 'Share a thought on this title…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={MAX_LENGTH + 500}
            disabled={submitting}
            aria-label={replyTo ? `Reply to ${replyTo.username}` : 'Add a comment'}
            aria-invalid={over || undefined}
          />
          <div className="nc-composer-footer">
            <div className="nc-composer-meta">
              {showTimestamp && liveTime != null && (
                <button type="button" className={`nc-composer-ts-toggle${attachTs ? ' nc-composer-ts-toggle--active' : ''}`}
                  onClick={() => setAttachTs((attached) => !attached)}
                  aria-pressed={attachTs}
                  aria-label={attachTs ? "Don't attach the current time" : 'Add timestamp'}
                  title={attachTs ? 'Remove timestamp' : 'Attach the current playback time'}>
                  <ClockIcon width={11} height={11} />
                  {formatVideoTime(liveTime)}
                </button>
              )}
              {text.length >= COUNTER_VISIBLE_AT && (
                <span
                  className={`nc-composer-count${over ? ' nc-composer-count--over' : remaining <= 40 ? ' nc-composer-count--warn' : ''}`}
                  aria-live="polite"
                >
                  {remaining}
                </span>
              )}
            </div>
            <div className="nc-composer-actions">
              <span className="nc-composer-hint" title="Command or Control + Enter to post">⌘ / Ctrl ↵</span>
              <button type="submit" className="nc-post-btn" disabled={!canSubmit}>
                {submitting ? <span className="nc-spinner" aria-hidden="true" /> : <ArrowUpIcon width={16} height={16} />}
                <span className="nc-visually-hidden">{submitting ? 'Posting…' : replyTo ? 'Reply' : 'Post'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
