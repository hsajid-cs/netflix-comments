import type { AuthUser, NetflixTitleState } from './types'

/**
 * Typed message contract between the content script/UI, popup, and background
 * service worker. Extend this union as real features (comments, auth) land —
 * do not send untyped/ad-hoc messages via chrome.runtime.
 *
 * The background service worker is the only place allowed to talk to the
 * backend (see README/decisions) — every comments-related message here is a
 * request for the background worker to perform one HTTP call and relay the
 * result back, never a message the content script/UI resolves itself.
 */
export type ExtensionMessage =
  | { type: 'TITLE_DETECTED'; payload: NetflixTitleState }
  | { type: 'FETCH_COMMENTS'; payload: { netflixTitleId: string } }
  | {
      type: 'CREATE_COMMENT'
      payload: { netflixTitleId: string; text: string; parentCommentId?: string; videoTimeSeconds?: number }
    }
  | { type: 'CREATE_REPLY'; payload: { commentId: string; text: string } }
  | { type: 'UPDATE_COMMENT'; payload: { commentId: string; text: string } }
  | { type: 'DELETE_COMMENT'; payload: { commentId: string } }
  | { type: 'TOGGLE_LIKE'; payload: { commentId: string } }
  | { type: 'TOGGLE_DISAGREE'; payload: { commentId: string } }
  // Auth. The background worker performs the HTTP call, then stores/clears the
  // token in chrome.storage.local itself — the token is never returned here.
  | { type: 'AUTH_SIGNUP'; payload: { username: string; password: string } }
  | { type: 'AUTH_LOGIN'; payload: { username: string; password: string } }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_GET_SESSION' }
  // The signed-in user's aggregate activity. Bearer-authed HTTP call in the worker.
  | { type: 'STATS_GET' }

/** The identity half of an auth response — all the UI ever receives. */
export type AuthSession = { user: AuthUser } | null

/** Uniform success/failure envelope the background worker responds with for every API-backed message. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function sendMessage(message: ExtensionMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(message)
}
