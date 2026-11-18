import { Router } from 'express'
import { authRouter } from './auth.routes.js'
import { commentsRouter } from './comments.routes.js'

export const router = Router()

router.use(authRouter)
router.use(commentsRouter)
