import type { NextFunction, Request, Response } from 'express'
import { authService } from '../services/auth.service.js'
import { loginSchema, signupSchema } from '../validation/auth.validation.js'

export const authController = {
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = signupSchema.parse(req.body)
      const result = await authService.signup(username, password)
      res.status(201).json(result)
    } catch (error) {
      next(error)
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = loginSchema.parse(req.body)
      const result = await authService.login(username, password)
      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  },

  /**
   * Stateless tokens can't be revoked server-side without a blacklist (out of
   * scope), so logout is a client concern: the extension discards the stored
   * token. This endpoint exists for symmetry / future revocation.
   */
  logout(_req: Request, res: Response) {
    res.status(204).end()
  },

  /** Current identity, from the verified token (requires `requireAuth`). */
  me(req: Request, res: Response) {
    res.status(200).json({ user: req.user })
  },
}
