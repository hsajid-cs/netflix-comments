import { Router } from 'express'
import { authController } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/require-auth.js'

export const authRouter = Router()

authRouter.post('/auth/signup', authController.signup)
authRouter.post('/auth/login', authController.login)
authRouter.post('/auth/logout', authController.logout)
authRouter.get('/auth/me', requireAuth, authController.me)
