import { AUTH_STORAGE_KEY } from '../shared/constants'
import type { AuthUser } from '../shared/types'

/**
 * Persisted auth session. Lives ONLY in the background service worker's reach:
 * `chrome.storage.local` under a single key. The content script / injected UI
 * never receives the token — it only ever learns the `user` half (via an
 * ApiResult from a message). `chrome.storage.local` is per-extension and not
 * reachable from web pages, so a token here is not exposed to Netflix.
 */
export interface StoredSession {
  token: string
  user: AuthUser
}

export async function getSession(): Promise<StoredSession | null> {
  const stored = await chrome.storage.local.get(AUTH_STORAGE_KEY)
  const value = stored[AUTH_STORAGE_KEY] as StoredSession | undefined
  return value && typeof value.token === 'string' && value.user ? value : null
}

export async function getToken(): Promise<string | null> {
  return (await getSession())?.token ?? null
}

export async function setSession(session: StoredSession): Promise<void> {
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: session })
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(AUTH_STORAGE_KEY)
}
