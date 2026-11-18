import { sendMessage } from '../../shared/messaging'
import type { ApiResult, ExtensionMessage } from '../../shared/messaging'

/**
 * Thrown for any failed background/API call, with a message safe to show
 * directly in the UI (already extracted from the backend's error response, or a
 * friendly fallback for a transport-level failure).
 */
export class ApiError extends Error {}

/**
 * The one seam the UI uses to reach the backend: send a typed message to the
 * background service worker (the only context allowed to make real HTTP calls)
 * and unwrap its uniform ApiResult envelope. Callers never see HTTP.
 */
export async function call<T>(message: ExtensionMessage): Promise<T> {
  let result: ApiResult<T> | undefined
  try {
    result = (await sendMessage(message)) as ApiResult<T> | undefined
  } catch {
    throw new ApiError('The extension connection was interrupted. Reload Netflix and try again.')
  }
  if (!result) {
    throw new ApiError('The extension background service did not respond.')
  }
  if (!result.ok) {
    throw new ApiError(result.error)
  }
  return result.data
}
