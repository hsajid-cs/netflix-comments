import { useCallback, useEffect, useRef, useState } from 'react'
import { AUTH_STORAGE_AREA, AUTH_STORAGE_KEY } from '../../shared/constants'
import type { AuthUser } from '../../shared/types'
import { authApi, AuthApiError } from '../services/authApi'

const GENERIC_AUTH_ERROR = 'Something went wrong. Please try again.'

export type AuthStatus = 'loading' | 'ready'

export interface UseAuthResult {
  user: AuthUser | null
  status: AuthStatus
  /** Transient error from the last signup/login/logout attempt. */
  error: string | null
  signup: (username: string, password: string) => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  dismissError: () => void
}

function message(err: unknown): string {
  return err instanceof AuthApiError ? err.message : GENERIC_AUTH_ERROR
}

/**
 * Auth state for both the popup and the in-page panel. The session itself lives
 * in the background worker + chrome.storage.local; this hook reads it on mount
 * and then listens for `chrome.storage.onChanged` so that logging in/out in the
 * popup updates the in-page panel live (and vice versa) without a reload.
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const session = await authApi.getSession()
      if (mounted.current) setUser(session?.user ?? null)
    } catch {
      if (mounted.current) setUser(null)
    } finally {
      if (mounted.current) setStatus('ready')
    }
  }, [])

  useEffect(() => {
    void refresh()

    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === AUTH_STORAGE_AREA && AUTH_STORAGE_KEY in changes) void refresh()
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [refresh])

  const run = useCallback(async (op: () => Promise<AuthUser | null>) => {
    setError(null)
    try {
      const next = await op()
      if (mounted.current) setUser(next)
    } catch (err) {
      if (mounted.current) setError(message(err))
      throw err
    }
  }, [])

  const signup = useCallback(
    (username: string, password: string) =>
      run(async () => (await authApi.signup({ username, password }))?.user ?? null),
    [run],
  )

  const login = useCallback(
    (username: string, password: string) =>
      run(async () => (await authApi.login({ username, password }))?.user ?? null),
    [run],
  )

  const logout = useCallback(
    () =>
      run(async () => {
        await authApi.logout()
        return null
      }),
    [run],
  )

  return { user, status, error, signup, login, logout, dismissError: () => setError(null) }
}
