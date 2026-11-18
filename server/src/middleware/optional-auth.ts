import type { NextFunction, Request, Response } from 'express'
import { authService } from '../services/auth.service.js'
import { bearerToken } from './require-auth.js'

/**
 * Soft auth. If a valid bearer token is present, attaches `req.user`; if it is
 * absent or invalid, the request proceeds anonymously (`req.user` undefined).
 * Used for read endpoints that anonymous users may access but that return
 * extra per-user data (e.g. `likedByMe`) when signed in.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = bearerToken(req)
  if (token) {
    try {
      req.user = authService.verifyAccessToken(token)
    } catch {
      // Ignore a bad/expired token here — treat as anonymous rather than 401.
    }
  }
  next()
}
