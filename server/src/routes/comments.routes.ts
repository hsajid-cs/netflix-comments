import { Router } from 'express'
import { commentsController } from '../controllers/comments.controller.js'
import { optionalAuth } from '../middleware/optional-auth.js'
import { requireAuth } from '../middleware/require-auth.js'

export const commentsRouter = Router()

// Writes require a valid app session; the author is taken from the token.
commentsRouter.post('/comments', requireAuth, commentsController.create)
commentsRouter.post('/comments/:commentId/like', requireAuth, commentsController.like)
commentsRouter.post('/comments/:commentId/disagree', requireAuth, commentsController.disagree)
commentsRouter.post('/comments/:commentId/replies', requireAuth, commentsController.reply)
// Edit / delete are restricted to the comment's own author (checked in the service).
commentsRouter.patch('/comments/:commentId', requireAuth, commentsController.update)
commentsRouter.delete('/comments/:commentId', requireAuth, commentsController.remove)

// Reads are open to anonymous users; a token, if present, enables `likedByMe`.
commentsRouter.get('/titles/:netflixTitleId/comments', optionalAuth, commentsController.listForTitle)

// The signed-in user's own aggregate activity (popup "Your activity" card).
commentsRouter.get('/me/stats', requireAuth, commentsController.myStats)
