import type { UserStats } from '../../shared/types'
import { call } from './call'

export { ApiError as StatsApiError } from './call'

/**
 * The seam the popup uses for the signed-in user's "Your activity" numbers.
 * Like the other `*Api` modules it just messages the background worker (the
 * only context that makes HTTP calls) and unwraps the result.
 */
export const statsApi = {
  get(): Promise<UserStats> {
    return call({ type: 'STATS_GET' })
  },
}
