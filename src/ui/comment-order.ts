import type { Comment } from '../shared/types'

export type SortMode = 'top' | 'newest' | 'moment'

/** Sort roots without changing the API tree or the chronological reply order. */
export function sortComments(comments: Comment[], mode: SortMode): Comment[] {
  return [...comments].sort((a, b) => {
    if (mode === 'top') return b.likeCount - a.likeCount || Date.parse(b.createdAt) - Date.parse(a.createdAt)
    if (mode === 'newest') return Date.parse(b.createdAt) - Date.parse(a.createdAt)
    const at = a.videoTimeSeconds ?? Infinity
    const bt = b.videoTimeSeconds ?? Infinity
    return (at === bt ? 0 : at - bt) || Date.parse(a.createdAt) - Date.parse(b.createdAt)
  })
}

/** Find the next timestamp, or the last timestamp when playback is past them all. */
export function findCommentAtMoment(comments: Comment[], seconds: number): Comment | undefined {
  const stamped = sortComments(comments, 'moment').filter((c) => c.videoTimeSeconds != null)
  return stamped.find((c) => c.videoTimeSeconds! >= seconds) ?? stamped.at(-1)
}

/** Replies can live beyond the rendered root batch, too. */
export function containsComment(comment: Comment, id: string): boolean {
  return comment.id === id || comment.replies.some((reply) => containsComment(reply, id))
}
