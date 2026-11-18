import type { Comment, CommentBase, ReactionState } from '../../shared/types'
import { call } from './call'

// Kept as `CommentsApiError` for existing callers; it's the shared ApiError.
export { ApiError as CommentsApiError } from './call'

/**
 * The only seam the UI uses to reach the backend for comments. Internally this
 * messages the background service worker (the only context allowed to make real
 * HTTP calls — see src/background/service-worker.ts) rather than fetching directly, but
 * callers never need to know that: this module is the entire contract.
 */
export const commentsApi = {
  getComments(netflixTitleId: string): Promise<Comment[]> {
    return call({ type: 'FETCH_COMMENTS', payload: { netflixTitleId } })
  },

  createComment(input: {
    netflixTitleId: string
    text: string
    parentCommentId?: string
    videoTimeSeconds?: number
  }): Promise<CommentBase> {
    return call({ type: 'CREATE_COMMENT', payload: input })
  },

  createReply(commentId: string, text: string): Promise<CommentBase> {
    return call({ type: 'CREATE_REPLY', payload: { commentId, text } })
  },

  editComment(commentId: string, text: string): Promise<CommentBase> {
    return call({ type: 'UPDATE_COMMENT', payload: { commentId, text } })
  },

  deleteComment(commentId: string): Promise<{ softDeleted: boolean; comment: CommentBase | null }> {
    return call({ type: 'DELETE_COMMENT', payload: { commentId } })
  },

  toggleDisagree(commentId: string): Promise<ReactionState> {
    return call({ type: 'TOGGLE_DISAGREE', payload: { commentId } })
  },

  toggleLike(commentId: string): Promise<ReactionState> {
    return call({ type: 'TOGGLE_LIKE', payload: { commentId } })
  },
}
