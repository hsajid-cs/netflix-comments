import { useCallback, useEffect, useRef, useState } from 'react'
import type { Comment, CommentsStatus } from '../types'
import { commentsApi, CommentsApiError } from '../services/commentsApi'
import type { ErrorKind } from '../components/ErrorState'

const GENERIC_FETCH_ERROR = 'Could not load comments. Please check your connection and try again.'
const GENERIC_POST_ERROR = 'Could not post your comment. Please try again.'
const GENERIC_REACTION_ERROR = 'Could not update your reaction. Please try again.'
const GENERIC_EDIT_ERROR = 'Could not save your edit. Please try again.'
const GENERIC_DELETE_ERROR = 'Could not delete your comment. Please try again.'

// The background worker's wording for a transport-level failure (see
// src/background/service-worker.ts). Matching it lets us pick the "server" error state.
const SERVER_UNREACHABLE_HINT = 'reach the comments server'

// Debounce a title switch so scrubbing quickly through Netflix titles fires one
// request for wherever the user lands, not one per title passed through.
const NAVIGATE_DEBOUNCE_MS = 180

// How long a freshly posted comment keeps its highlight ring.
const NEW_COMMENT_HIGHLIGHT_MS = 2400

export interface UseCommentsResult {
  status: CommentsStatus
  comments: Comment[]
  error: string | null
  errorKind: ErrorKind
  /** Transient error from posting a comment/reply or toggling a like — separate from the initial-load error. */
  actionError: string | null
  /** Id of the comment just created by this client, for a one-shot highlight. */
  newCommentId: string | null
  /** True while a retry() triggered reload is in flight. */
  retrying: boolean
  addComment: (text: string, parentCommentId?: string, videoTimeSeconds?: number) => Promise<Comment>
  editComment: (id: string, text: string) => Promise<void>
  deleteComment: (id: string) => Promise<void>
  toggleLike: (id: string) => void
  toggleDisagree: (id: string) => void
  retry: () => void
  dismissActionError: () => void
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof CommentsApiError ? err.message : fallback
}

function classifyError(raw: string): ErrorKind {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'
  if (raw.toLowerCase().includes(SERVER_UNREACHABLE_HINT)) return 'server'
  return 'generic'
}

/** Inserts a freshly-created comment into the tree: appended as a new root, or into its parent's `replies`. */
function insertComment(tree: Comment[], created: Comment): Comment[] {
  if (!created.parentCommentId) {
    return [...tree, created]
  }
  return tree.map((comment) => insertIntoNode(comment, created))
}

function insertIntoNode(node: Comment, created: Comment): Comment {
  if (node.id === created.parentCommentId) {
    return { ...node, replies: [...node.replies, created] }
  }
  if (node.replies.length === 0) return node
  return { ...node, replies: node.replies.map((reply) => insertIntoNode(reply, created)) }
}

/** Immutably updates the comment matching `id` anywhere in the tree. */
function updateNode(tree: Comment[], id: string, updater: (comment: Comment) => Comment): Comment[] {
  return tree.map((comment) => {
    if (comment.id === id) return updater(comment)
    if (comment.replies.length === 0) return comment
    return { ...comment, replies: updateNode(comment.replies, id, updater) }
  })
}

/** Immutably removes the comment matching `id` (and its subtree) from anywhere in the tree. */
function removeNode(tree: Comment[], id: string): Comment[] {
  const out: Comment[] = []
  for (const comment of tree) {
    if (comment.id === id) continue
    out.push(comment.replies.length === 0 ? comment : { ...comment, replies: removeNode(comment.replies, id) })
  }
  return out
}

/**
 * Real data source for the comments panel, backed by `commentsApi`
 * (which itself talks to the background service worker, never HTTP directly
 * — see src/ui/services/commentsApi.ts).
 */
export function useComments(titleId: string | null, userId: string | null = null): UseCommentsResult {
  const [status, setStatus] = useState<CommentsStatus>('loading')
  const [comments, setComments] = useState<Comment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<ErrorKind>('generic')
  const [actionError, setActionError] = useState<string | null>(null)
  const [newCommentId, setNewCommentId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const requestIdRef = useRef(0)
  const pendingReactions = useRef(new Set<string>())
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const load = useCallback(
    (opts?: { isRetry?: boolean }) => {
      const requestId = ++requestIdRef.current
      // On a retry, keep whatever is on screen (usually the error state) until
      // the result lands; on a fresh load (mount / title change) show the
      // skeleton.
      if (opts?.isRetry) setRetrying(true)
      else setStatus('loading')
      setError(null)

      if (!titleId) {
        setComments([])
        setStatus('success')
        setRetrying(false)
        return
      }

      commentsApi
        .getComments(titleId)
        .then((data) => {
          if (requestIdRef.current !== requestId) return // stale response, title changed since
          setComments(data)
          setStatus('success')
          setRetrying(false)
        })
        .catch((err) => {
          if (requestIdRef.current !== requestId) return
          const msg = errorMessage(err, GENERIC_FETCH_ERROR)
          setError(msg)
          setErrorKind(classifyError(msg))
          setStatus('error')
          setRetrying(false)
        })
    },
    [titleId, userId],
  )

  useEffect(() => {
    // Debounce so rapid title-to-title navigation doesn't fan out requests;
    // the requestId guard already discards any that do land out of order.
    const t = setTimeout(() => load(), NAVIGATE_DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      requestIdRef.current++
    }
  }, [load])

  // Auto-recover: if we're showing a load error and the browser comes back
  // online, retry without making the user click.
  useEffect(() => {
    if (status !== 'error') return
    const onOnline = () => load({ isRetry: true })
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [status, load])

  useEffect(() => () => clearTimeout(highlightTimer.current), [])

  const flashNew = useCallback((id: string) => {
    setNewCommentId(id)
    clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setNewCommentId(null), NEW_COMMENT_HIGHLIGHT_MS)
  }, [])

  // Not optimistic: wait for the server so only a real persisted row is shown
  // (with its real id/createdAt/author). Returns the normalized node so the
  // caller can scroll it into view.
  const addComment = useCallback(
    async (text: string, parentCommentId?: string, videoTimeSeconds?: number): Promise<Comment> => {
      if (!titleId) throw new CommentsApiError('This title could not be identified.')
      setActionError(null)
      try {
        const created = parentCommentId
          ? await commentsApi.createReply(parentCommentId, text)
          : await commentsApi.createComment({ netflixTitleId: titleId, text, videoTimeSeconds })
        const normalized: Comment = { ...created, likedByMe: false, disagreedByMe: false, replies: [] }
        setComments((prev) => insertComment(prev, normalized))
        flashNew(normalized.id)
        return normalized
      } catch (err) {
        setActionError(errorMessage(err, GENERIC_POST_ERROR))
        throw err
      }
    },
    [titleId, flashNew],
  )

  // Not optimistic (same reasoning as addComment): the server owns the new
  // text and the `editedAt` stamp. On success, patch just that node in place.
  const editComment = useCallback(
    async (id: string, text: string): Promise<void> => {
      setActionError(null)
      try {
        const updated = await commentsApi.editComment(id, text)
        setComments((prev) =>
          updateNode(prev, id, (comment) => ({ ...comment, text: updated.text, editedAt: updated.editedAt })),
        )
      } catch (err) {
        setActionError(errorMessage(err, GENERIC_EDIT_ERROR))
        throw err
      }
    },
    [],
  )

  // Not optimistic: the server decides whether the comment is removed outright
  // (a leaf) or kept as a tombstone (still has replies), so wait for its answer
  // and reshape the tree to match.
  const deleteComment = useCallback(
    async (id: string): Promise<void> => {
      setActionError(null)
      try {
        const result = await commentsApi.deleteComment(id)
        if (result.softDeleted && result.comment) {
          const tombstone = result.comment
          setComments((prev) =>
            updateNode(prev, id, (comment) => ({
              ...comment,
              text: tombstone.text,
              deletedAt: tombstone.deletedAt,
              videoTimeSeconds: tombstone.videoTimeSeconds,
            })),
          )
        } else {
          setComments((prev) => removeNode(prev, id))
        }
      } catch (err) {
        setActionError(errorMessage(err, GENERIC_DELETE_ERROR))
        throw err
      }
    },
    [],
  )

  // Wait for the persisted reaction; serialize local clicks on the same comment.
  const toggleReaction = useCallback((id: string, reaction: 'like' | 'disagree') => {
    if (pendingReactions.current.has(id)) return
    pendingReactions.current.add(id)
    setActionError(null)
    const requestId = requestIdRef.current
    const request = reaction === 'like' ? commentsApi.toggleLike(id) : commentsApi.toggleDisagree(id)
    request.then(
      (result) => {
        if (requestIdRef.current !== requestId) return
        setComments((prev) => updateNode(prev, id, (comment) => ({ ...comment, ...result })))
      },
      (err) => {
        if (requestIdRef.current === requestId) setActionError(errorMessage(err, GENERIC_REACTION_ERROR))
      },
    ).finally(() => pendingReactions.current.delete(id))
  }, [])

  return {
    status,
    comments,
    error,
    errorKind,
    actionError,
    newCommentId,
    retrying,
    addComment,
    editComment,
    deleteComment,
    toggleLike: (id) => toggleReaction(id, 'like'),
    toggleDisagree: (id) => toggleReaction(id, 'disagree'),
    retry: () => load({ isRetry: true }),
    dismissActionError: () => setActionError(null),
  }
}
