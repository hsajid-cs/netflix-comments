import type { NextFunction, Request, Response } from 'express'
import { authService } from '../services/auth.service.js'
import { UnauthorizedError } from '../utils/app-error.js'

/** Extracts a bearer token from the Authorization header, or null if absent/malformed. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

/**
 * Hard auth gate. Rejects the request with 401 unless it carries a valid
 * app-issued bearer token; on success `req.user` is the identity from the
 * token (never from the request body).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = bearerToken(req)
  if (!token) {
    next(new UnauthorizedError('Authentication required'))
    return
  }
  try {
    req.user = authService.verifyAccessToken(token)
    next()
  } catch (error) {
    next(error)
  }
}
