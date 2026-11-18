import type { NextFunction, Request, Response } from 'express'
import { commentsService } from '../services/comments.service.js'
import {
  commentIdParamsSchema,
  createCommentSchema,
  createReplySchema,
  titleParamsSchema,
  updateCommentSchema,
} from '../validation/comments.validation.js'

export const commentsController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createCommentSchema.parse(req.body)
      const comment = await commentsService.createComment(input, req.user!)
      res.status(201).json(comment)
    } catch (error) {
      next(error)
    }
  },

  async myStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await commentsService.getUserStats(req.user!)
      res.status(200).json(stats)
    } catch (error) {
      next(error)
    }
  },

  async listForTitle(req: Request, res: Response, next: NextFunction) {
    try {
      const { netflixTitleId } = titleParamsSchema.parse(req.params)
      // optionalAuth: req.user is set only when a valid token was sent.
      const comments = await commentsService.getCommentsForTitle(netflixTitleId, req.user ?? null)
      res.status(200).json(comments)
    } catch (error) {
      next(error)
    }
  },

  async like(req: Request, res: Response, next: NextFunction) {
    try {
      const { commentId } = commentIdParamsSchema.parse(req.params)
      const result = await commentsService.toggleReaction(commentId, req.user!, 'like')
      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  },

  async disagree(req: Request, res: Response, next: NextFunction) {
    try {
      const { commentId } = commentIdParamsSchema.parse(req.params)
      const result = await commentsService.toggleReaction(commentId, req.user!, 'disagree')
      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  },

  async reply(req: Request, res: Response, next: NextFunction) {
    try {
      const { commentId } = commentIdParamsSchema.parse(req.params)
      const { text } = createReplySchema.parse(req.body)
      const comment = await commentsService.createReply(commentId, text, req.user!)
      res.status(201).json(comment)
    } catch (error) {
      next(error)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { commentId } = commentIdParamsSchema.parse(req.params)
      const { text } = updateCommentSchema.parse(req.body)
      const comment = await commentsService.updateComment(commentId, text, req.user!)
      res.status(200).json(comment)
    } catch (error) {
      next(error)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const { commentId } = commentIdParamsSchema.parse(req.params)
      const result = await commentsService.deleteComment(commentId, req.user!)
      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  },
}
