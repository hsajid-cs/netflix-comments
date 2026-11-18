import type { ApiResult, AuthSession, ExtensionMessage } from '../shared/messaging'
import { API_BASE_URL } from '../shared/constants'
import type { AuthUser, Comment, CommentBase, ReactionState, UserStats } from '../shared/types'
import { clearSession, getSession, getToken, setSession } from './authStore'
import { requestJson } from './request'

// Central place for all backend calls, auth, and storage — the content
// script/UI never talks to the backend directly (see README/decisions); they
// send a typed ExtensionMessage here and get an ApiResult back.
async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const token = await getToken()

  return requestJson<T>(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  }, { onUnauthorized: clearSession })
}

/** Backend shape for POST /auth/signup and /auth/login. */
interface AuthResponse {
  user: AuthUser
  token: string
}

/** Runs an auth request, persists the session on success, returns only the user. */
async function authenticate(
  path: '/auth/signup' | '/auth/login',
  payload: { username: string; password: string },
): Promise<ApiResult<AuthSession>> {
  const result = await apiFetch<AuthResponse>(path, { method: 'POST', body: JSON.stringify(payload) })
  if (!result.ok) return result
  await setSession({ token: result.data.token, user: result.data.user })
  return { ok: true, data: { user: result.data.user } }
}

async function handleMessage(message: ExtensionMessage): Promise<ApiResult<unknown> | undefined> {
  switch (message.type) {
    case 'TITLE_DETECTED':
      return undefined

    case 'FETCH_COMMENTS':
      return apiFetch<Comment[]>(`/titles/${encodeURIComponent(message.payload.netflixTitleId)}/comments`)

    case 'CREATE_COMMENT':
      return apiFetch<CommentBase>('/comments', {
        method: 'POST',
        body: JSON.stringify(message.payload),
      })

    case 'CREATE_REPLY':
      return apiFetch<CommentBase>(`/comments/${encodeURIComponent(message.payload.commentId)}/replies`, {
        method: 'POST',
        body: JSON.stringify({ text: message.payload.text }),
      })

    case 'UPDATE_COMMENT':
      return apiFetch<CommentBase>(`/comments/${encodeURIComponent(message.payload.commentId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: message.payload.text }),
      })

    case 'DELETE_COMMENT':
      return apiFetch<{ softDeleted: boolean; comment: CommentBase | null }>(
        `/comments/${encodeURIComponent(message.payload.commentId)}`,
        { method: 'DELETE' },
      )

    case 'TOGGLE_LIKE':
      return apiFetch<ReactionState>(
        `/comments/${encodeURIComponent(message.payload.commentId)}/like`,
        { method: 'POST' },
      )

    case 'TOGGLE_DISAGREE':
      return apiFetch<ReactionState>(
        `/comments/${encodeURIComponent(message.payload.commentId)}/disagree`,
        { method: 'POST' },
      )

    case 'AUTH_SIGNUP':
      return authenticate('/auth/signup', message.payload)

    case 'AUTH_LOGIN':
      return authenticate('/auth/login', message.payload)

    case 'AUTH_LOGOUT': {
      // Best-effort server call; the local session is cleared regardless.
      await apiFetch<null>('/auth/logout', { method: 'POST' })
      await clearSession()
      return { ok: true, data: null }
    }

    case 'AUTH_GET_SESSION': {
      const session = await getSession()
      return { ok: true, data: session ? { user: session.user } : null }
    }

    case 'STATS_GET':
      return apiFetch<UserStats>('/me/stats')
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse, () => {
    sendResponse({ ok: false, error: 'The extension could not complete the request. Please try again.' })
  })
  return true // keep the message channel open for the async sendResponse above
})
