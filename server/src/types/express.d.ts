import type { AuthedUser } from '../models/user.js'

/**
 * Augments Express's `Request` with the authenticated user, populated by
 * `middleware/require-auth.ts` (always) or `middleware/optional-auth.ts` (only
 * when a valid token is present). Previously lived inline in the now-deleted
 * `middleware/dev-auth.ts`.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser
    }
  }
}

export {}
