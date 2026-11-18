import type { AuthSession } from '../../shared/messaging'
import { call } from './call'

export { ApiError as AuthApiError } from './call'

type Credentials = { username: string; password: string }

/**
 * The only seam the UI (popup and in-page panel) uses for authentication. Every
 * method messages the background service worker, which performs the HTTP call
 * and owns the token — this layer only ever sees the `{ user }` half.
 */
export const authApi = {
  signup(credentials: Credentials): Promise<AuthSession> {
    return call({ type: 'AUTH_SIGNUP', payload: credentials })
  },

  login(credentials: Credentials): Promise<AuthSession> {
    return call({ type: 'AUTH_LOGIN', payload: credentials })
  },

  logout(): Promise<null> {
    return call({ type: 'AUTH_LOGOUT' })
  },

  getSession(): Promise<AuthSession> {
    return call({ type: 'AUTH_GET_SESSION' })
  },
}
