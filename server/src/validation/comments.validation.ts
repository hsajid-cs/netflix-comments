import { z } from 'zod'

const netflixTitleId = z.string().trim().min(1).max(64)
const commentText = z.string().trim().min(1).max(2000)
const uuid = z.string().uuid()

// Playback position in whole seconds. Capped at 24h — far beyond any Netflix
// title runtime, but a cheap guard against junk values.
const videoTimeSeconds = z.number().int().nonnegative().max(86_400)

export const createCommentSchema = z.object({
  netflixTitleId,
  text: commentText,
  parentCommentId: uuid.optional(),
  videoTimeSeconds: videoTimeSeconds.optional(),
})

export const createReplySchema = z.object({
  text: commentText,
})

export const updateCommentSchema = z.object({
  text: commentText,
})

export const titleParamsSchema = z.object({
  netflixTitleId,
})

export const commentIdParamsSchema = z.object({
  commentId: uuid,
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type CreateReplyInput = z.infer<typeof createReplySchema>
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>
