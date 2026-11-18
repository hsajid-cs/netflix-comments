import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { NetflixTitleState } from '../../shared/types'
import type { Comment } from '../types'
import { discussionId, episodeLabel, type DiscussionScope } from '../discussion-scope'
import { findCommentAtMoment, sortComments, type SortMode } from '../comment-order'
import { useComments } from '../hooks/useComments'
import { useAuth } from '../hooks/useAuth'
import { usePanelPrefs } from '../hooks/usePanelPrefs'
import { useScrollShadows } from '../hooks/useScrollShadows'
import CommentsHeader from './CommentsHeader'
import CommentComposer from './CommentComposer'
import CommentList from './CommentList'
import EmptyState from './EmptyState'
import LoadingState from './LoadingState'
import ErrorState from './ErrorState'
import EpisodeActivity from './EpisodeActivity'
import { AlertIcon, ChatIcon, CloseIcon, UserIcon } from './icons'

const HEADING_ID = 'nc-panel-heading'

function countComments(comments: Comment[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0)
}

interface PanelProps {
  title: NetflixTitleState
  isWatch?: boolean
  currentVideoTime?: number | null
  videoDuration?: number | null
  getVideoTime?: () => number | null
  onSeek?: (seconds: number) => void
}

/** Scope changes remount the discussion so drafts, requests and reveals stay isolated. */
export default function CommentsPanel(props: PanelProps) {
  const [scope, setScope] = useState<DiscussionScope>(props.isWatch ? 'episode' : 'series')
  const threadId = discussionId(props.title, scope)
  return <DiscussionPanel key={`${scope}:${threadId}`} {...props} scope={scope} threadId={threadId} onScopeChange={setScope} />
}

function DiscussionPanel({
  title,
  isWatch = false,
  currentVideoTime = null,
  videoDuration = null,
  getVideoTime,
  onSeek,
  scope,
  threadId,
  onScopeChange,
}: PanelProps & {
  scope: DiscussionScope
  threadId: string | null
  onScopeChange: (scope: DiscussionScope) => void
}) {
  const timestampsEnabled = isWatch && scope === 'episode'
  const titleDetected = threadId != null

  const { prefs, hydrated, update } = usePanelPrefs({
    open: true,
    // Start collapsed on a /watch/ page so the panel never covers the video
    // controls the instant playback begins; expanded on a /title/ detail page.
    minimized: title.pageType === 'watch',
  })
  const isOpen = prefs.open
  const isMinimized = prefs.minimized

  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null)
  const [focusToken, setFocusToken] = useState(0)
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [scrollToId, setScrollToId] = useState<string | null>(null)

  const launcherRef = useRef<HTMLButtonElement>(null)
  const didMount = useRef(false)
  const scrollClearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { user } = useAuth()
  const { status, comments, error, errorKind, actionError, newCommentId, retrying, addComment, editComment, deleteComment, toggleLike, toggleDisagree, retry, dismissActionError } =
    useComments(threadId, user?.id ?? null)
  const isAuthenticated = !!user

  const commentCount = useMemo(() => countComments(comments), [comments])
  const { ref: bodyRef, edges } = useScrollShadows([comments, status, isMinimized, isOpen, hydrated])

  // "By moment": root comments ordered by their playback timestamp (earliest
  // first), the un-timestamped ones after. Replies keep their own order.
  const rootComments = useMemo(() => sortComments(comments, sortMode), [comments, sortMode])

  const showToolbar = commentCount > 0

  useEffect(() => () => clearTimeout(scrollClearTimer.current), [])

  function jumpToMySpot() {
    const now = getVideoTime?.()
    if (now == null) return
    const target = findCommentAtMoment(rootComments, now)
    if (!target) return
    setScrollToId(target.id)
    clearTimeout(scrollClearTimer.current)
    scrollClearTimer.current = setTimeout(() => setScrollToId(null), 1200)
  }

  // New title: drop any in-progress reply and jump the scroll region back to
  // the top so the previous title's position doesn't carry over.
  const prevTitleId = useRef(title.titleId)
  useEffect(() => {
    if (prevTitleId.current !== title.titleId) {
      prevTitleId.current = title.titleId
      setReplyTo(null)
      if (bodyRef.current) bodyRef.current.scrollTop = 0
    }
  }, [title.titleId, bodyRef])

  // Auto-collapse when playback starts, auto-expand when it stops, so the panel
  // default always matches whether the video transport is on screen.
  const prevPageType = useRef(title.pageType)
  useEffect(() => {
    if (prevPageType.current !== title.pageType) {
      prevPageType.current = title.pageType
      update({ minimized: title.pageType === 'watch' })
    }
  }, [title.pageType, update])

  // Return focus to the launcher when the panel is closed (not on first paint).
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    if (!isOpen) launcherRef.current?.focus()
  }, [isOpen])

  function openPanel() {
    update({ open: true, minimized: false })
    setFocusToken((t) => t + 1)
  }

  function toggleMinimize() {
    const next = !isMinimized
    update({ minimized: next })
    if (!next) setFocusToken((t) => t + 1)
  }

  // Netflix's player listens on `document` for space / arrows / f / m etc.
  // Stopping propagation here keeps every keystroke scoped to the panel (typing
  // still works — we don't preventDefault). Escape gets a progressive meaning.
  function handleKey(e: KeyboardEvent) {
    e.stopPropagation()
    if (e.type !== 'keydown' || e.key !== 'Escape') return
    if (replyTo) setReplyTo(null)
    else if (!isMinimized) update({ minimized: true })
    else update({ open: false })
  }

  // Launcher only needs to keep keystrokes off Netflix's player.
  const stopKey = (e: KeyboardEvent) => e.stopPropagation()

  async function handlePost(text: string, videoTimeSeconds?: number) {
    await addComment(text, replyTo?.id, videoTimeSeconds)
    setReplyTo(null)
  }

  // Hold first paint until we know the persisted open/minimized state, so the
  // panel doesn't visibly flip after mount.
  if (!hydrated) return null

  const launcher = !isOpen ? (
    <button
      ref={launcherRef}
      type="button"
      className="nc-launcher"
      onClick={openPanel}
      onKeyDown={stopKey}
      onKeyUp={stopKey}
      aria-label={`Open comments (${commentCount})`}
      title="Open comments"
    >
      <span className="nc-launcher-icon">
        <ChatIcon width={20} height={20} />
      </span>
      <span className="nc-launcher-count">{commentCount > 999 ? '999+' : commentCount}</span>
    </button>
  ) : null

  const statusMessage =
    !titleDetected
      ? "This Netflix title couldn't be identified."
      : status === 'loading'
        ? 'Loading comments…'
        : status === 'error'
          ? error ?? 'Comments failed to load.'
          : commentCount === 0
            ? 'No comments yet.'
            : `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'} loaded.`

  return (
    <>
      {launcher}
      <section
        className={`nc-panel${isMinimized ? ' nc-panel--minimized' : ''}`}
        hidden={!isOpen}
        aria-labelledby={HEADING_ID}
        onKeyDown={handleKey}
        onKeyUp={handleKey}
      >
        <p className="nc-visually-hidden" role="status" aria-live="polite">
          {statusMessage}
        </p>

        <CommentsHeader
          headingId={HEADING_ID}
          titleName={title.titleName}
          commentCount={commentCount}
          contextLabel={scope === 'episode' ? episodeLabel(title) : 'Entire series'}
          isMinimized={isMinimized}
          onToggleMinimize={toggleMinimize}
          onClose={() => update({ open: false })}
        />

        <div className="nc-collapse">
          <div className="nc-collapse-inner" inert={isMinimized ? true : undefined} aria-hidden={isMinimized || undefined}>
            {timestampsEnabled && videoDuration != null && Number.isFinite(videoDuration) && videoDuration > 0 && (
              <EpisodeActivity comments={comments} duration={videoDuration} currentTime={currentVideoTime} onSeek={onSeek} />
            )}
            <div className="nc-toolbar">
              <select className="nc-scope-select" aria-label="Comment scope" value={scope}
                onChange={(event) => onScopeChange(event.target.value as DiscussionScope)}>
                {isWatch && <option value="episode">This episode</option>}
                <option value="series" disabled={!title.seriesId || (isWatch && title.seriesId === title.episodeId)}>Entire series</option>
              </select>
              {showToolbar && (
                <div className="nc-sort-seg" role="group" aria-label="Sort comments">
                  <button type="button" className={`nc-sort-seg-btn${sortMode === 'top' ? ' nc-sort-seg-btn--active' : ''}`}
                    aria-pressed={sortMode === 'top'} onClick={() => setSortMode('top')}>Top</button>
                  <button type="button" className={`nc-sort-seg-btn${sortMode === 'newest' ? ' nc-sort-seg-btn--active' : ''}`}
                    aria-pressed={sortMode === 'newest'} onClick={() => setSortMode('newest')}>New</button>
                  {timestampsEnabled && <button type="button" className={`nc-sort-seg-btn${sortMode === 'moment' ? ' nc-sort-seg-btn--active' : ''}`}
                    aria-pressed={sortMode === 'moment'} onClick={() => setSortMode('moment')}>By moment</button>}
                </div>
              )}
            </div>
            {scope === 'series' && <p className="nc-scope-note">Whole-series discussion may contain spoilers for any episode.</p>}
            {!titleDetected ? (
              <div className="nc-body-wrap">
                <div className="nc-body">
                  <ErrorState kind="undetected" onRetry={retry} retrying={retrying} />
                </div>
              </div>
            ) : (
              <>
                {timestampsEnabled && sortMode === 'moment' && (
                  <div className="nc-moment-tools">
                    <button
                      type="button"
                      className="nc-jump-now"
                      onClick={jumpToMySpot}
                      disabled={currentVideoTime == null || !comments.some((c) => c.videoTimeSeconds != null)}
                    >
                      Jump to my spot
                    </button>
                  </div>
                )}

                <div
                  className="nc-body-wrap"
                  data-scroll-top={edges.top || undefined}
                  data-scroll-bottom={edges.bottom || undefined}
                >
                  <div className="nc-body" ref={bodyRef}>
                    {isAuthenticated ? (
                      <CommentComposer
                        replyTo={replyTo}
                        currentUsername={user?.username ?? null}
                        focusToken={focusToken}
                        captureTimestamp={timestampsEnabled}
                        getVideoTime={getVideoTime}
                        onCancelReply={() => setReplyTo(null)}
                        onSubmit={handlePost}
                      />
                    ) : (
                      <div className="nc-auth-prompt">
                        <span className="nc-auth-prompt-icon">
                          <UserIcon width={16} height={16} />
                        </span>
                        <p className="nc-auth-prompt-text">
                          <strong>Reading as a guest.</strong> Open the Netflix Comments toolbar icon to log
                          in or sign up, then you can post, reply, like, and disagree.
                        </p>
                      </div>
                    )}

                    {actionError && (
                      <div className="nc-action-error" role="alert">
                        <span className="nc-action-error-icon">
                          <AlertIcon width={15} height={15} />
                        </span>
                        <span className="nc-action-error-text">{actionError}</span>
                        <button
                          type="button"
                          className="nc-reply-chip-close"
                          onClick={dismissActionError}
                          aria-label="Dismiss error"
                        >
                          <CloseIcon width={13} height={13} />
                        </button>
                      </div>
                    )}

                    {status === 'loading' && <LoadingState />}
                    {status === 'error' && (
                      <ErrorState kind={errorKind} message={error} onRetry={retry} retrying={retrying} />
                    )}
                    {status === 'success' && comments.length === 0 && (
                      <EmptyState onStart={isAuthenticated ? () => setFocusToken((t) => t + 1) : undefined} />
                    )}
                    {status === 'success' && comments.length > 0 && (
                      <CommentList
                        key={threadId ?? 'none'}
                        comments={rootComments}
                        isAuthenticated={isAuthenticated}
                        currentUserId={user?.id ?? null}
                        newCommentId={newCommentId}
                        scrollToId={scrollToId}
                        currentVideoTime={timestampsEnabled ? currentVideoTime : null}
                        onToggleLike={toggleLike}
                        onToggleDisagree={toggleDisagree}
                        onReply={(id, username) => setReplyTo({ id, username })}
                        onEdit={editComment}
                        onDelete={deleteComment}
                        onSeek={timestampsEnabled ? onSeek : undefined}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
