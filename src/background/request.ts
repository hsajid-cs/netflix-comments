import type { ApiResult } from '../shared/messaging'

/** Bound both the connection and body read so a stalled API cannot trap the UI. */
export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  { timeoutMs = 15_000, onUnauthorized }: {
    timeoutMs?: number
    onUnauthorized?: () => Promise<void>
  } = {},
): Promise<ApiResult<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (response.status === 401) await onUnauthorized?.()

    let body: unknown = null
    if (response.status !== 204) {
      try {
        body = await response.json()
      } catch (error) {
        if (controller.signal.aborted) throw error
        if (response.ok) {
          return { ok: false, error: 'The comments server returned an invalid response. Please try again.' }
        }
      }
    }

    if (!response.ok) {
      const error = body && typeof body === 'object' && 'error' in body ? body.error : null
      const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : `Request failed (${response.status})`
      return { ok: false, error: message }
    }
    return { ok: true, data: body as T }
  } catch {
    return {
      ok: false,
      error: controller.signal.aborted
        ? 'The comments server took too long to respond. Please try again.'
        : 'Could not reach the comments server. Check your connection and try again.',
    }
  } finally {
    clearTimeout(timer)
  }
}
