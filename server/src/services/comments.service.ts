import { commentsRepository } from '../repositories/comments.repository.js'
import type { Comment, CommentWithReplies } from '../models/comment.js'
import type { AuthedUser, UserStats } from '../models/user.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error.js'

function buildTree(comments: Comment[], likedCommentIds: Set<string>, disagreedCommentIds: Set<string>): CommentWithReplies[] {
  const byId = new Map<string, CommentWithReplies>()
  for (const comment of comments) {
    byId.set(comment.id, { ...comment, likedByMe: likedCommentIds.has(comment.id), disagreedByMe: disagreedCommentIds.has(comment.id), replies: [] })
  }

  const roots: CommentWithReplies[] = []
  for (const comment of byId.values()) {
    if (comment.parentCommentId) {
      const parent = byId.get(comment.parentCommentId)
      // Parent already fetched (same title) — every comment in `comments` shares one title.
      if (parent) parent.replies.push(comment)
    } else {
      roots.push(comment)
    }
  }
  return roots
}

export const commentsService = {
  async getCommentsForTitle(
    netflixTitleId: string,
    user: AuthedUser | null,
  ): Promise<CommentWithReplies[]> {
    const comments = await commentsRepository.findByTitleId(netflixTitleId)
    // Anonymous readers have no likes of their own — skip the lookup entirely.
    const likedCommentIds = user
      ? await commentsRepository.findReactionCommentIds(netflixTitleId, user.id, 'like')
      : new Set<string>()
    const disagreedCommentIds = user
      ? await commentsRepository.findReactionCommentIds(netflixTitleId, user.id, 'disagree')
      : new Set<string>()
    return buildTree(comments, likedCommentIds, disagreedCommentIds)
  },

  async createComment(
    input: { netflixTitleId: string; text: string; parentCommentId?: string; videoTimeSeconds?: number },
    user: AuthedUser,
  ): Promise<Comment> {
    let parentCommentId: string | null = null

    if (input.parentCommentId) {
      const parent = await commentsRepository.findById(input.parentCommentId)
      if (!parent) {
        throw new NotFoundError(`Parent comment ${input.parentCommentId} not found`)
      }
      if (parent.netflixTitleId !== input.netflixTitleId) {
        throw new ValidationError('parentCommentId does not belong to the given netflixTitleId')
      }
      parentCommentId = parent.id
    }

    return commentsRepository.create({
      netflixTitleId: input.netflixTitleId,
      userId: user.id,
      username: user.username,
      text: input.text,
      parentCommentId,
      // A timestamp only makes sense on a top-level comment made while watching.
      videoTimeSeconds: parentCommentId ? null : input.videoTimeSeconds ?? null,
    })
  },

  async createReply(parentCommentId: string, text: string, user: AuthedUser): Promise<Comment> {
    const parent = await commentsRepository.findById(parentCommentId)
    if (!parent) {
      throw new NotFoundError(`Comment ${parentCommentId} not found`)
    }

    return commentsRepository.create({
      netflixTitleId: parent.netflixTitleId,
      userId: user.id,
      username: user.username,
      text,
      parentCommentId: parent.id,
      videoTimeSeconds: null,
    })
  },

  /** Edit the text of one's own, non-deleted comment. */
  async updateComment(commentId: string, text: string, user: AuthedUser): Promise<Comment> {
    const comment = await commentsRepository.findById(commentId)
    if (!comment || comment.deletedAt) {
      throw new NotFoundError(`Comment ${commentId} not found`)
    }
    if (comment.userId !== user.id) {
      throw new ForbiddenError('You can only edit your own comments')
    }
    return commentsRepository.updateText(commentId, text)
  },

  /**
   * Delete one's own comment. If it still has replies it is soft-deleted
   * (kept as a tombstone so the thread underneath survives); otherwise the
   * row is removed outright. `softDeleted` tells the client which happened —
   * on a hard delete the node should be dropped from the tree, on a soft
   * delete it should be replaced with the returned tombstone.
   */
  async deleteComment(
    commentId: string,
    user: AuthedUser,
  ): Promise<{ softDeleted: boolean; comment: Comment | null }> {
    const comment = await commentsRepository.findById(commentId)
    if (!comment || comment.deletedAt) {
      throw new NotFoundError(`Comment ${commentId} not found`)
    }
    if (comment.userId !== user.id) {
      throw new ForbiddenError('You can only delete your own comments')
    }

    if (await commentsRepository.hasReplies(commentId)) {
      const tombstone = await commentsRepository.softDelete(commentId)
      return { softDeleted: true, comment: tombstone }
    }
    await commentsRepository.hardDelete(commentId)
    return { softDeleted: false, comment: null }
  },

  async getUserStats(user: AuthedUser): Promise<UserStats> {
    return commentsRepository.statsForUser(user.id)
  },

  async toggleReaction(commentId: string, user: AuthedUser, reaction: 'like' | 'disagree') {
    const result = await commentsRepository.toggleReaction(commentId, user.id, reaction)
    if (!result) {
      throw new NotFoundError(`Comment ${commentId} not found`)
    }
    return result
  },
}
