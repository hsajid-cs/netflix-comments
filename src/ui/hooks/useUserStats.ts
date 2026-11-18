import { useEffect, useRef, useState } from 'react'
import type { UserStats } from '../../shared/types'
import { statsApi } from '../services/statsApi'

/**
 * Fetches the signed-in user's aggregate activity for the popup's
 * "Your activity" card. Fetched once per popup open (the popup is a fresh
 * document each time the toolbar icon is clicked), so no live sync is needed.
 * A failure just yields `stats: null` — the card is decorative, never blocking.
 */
export function useUserStats(enabled: boolean): { stats: UserStats | null; loading: boolean } {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(enabled)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setStats(null)
      setLoading(false)
      return
    }
    setLoading(true)
    statsApi
      .get()
      .then((data) => {
        if (mounted.current) setStats(data)
      })
      .catch(() => {
        if (mounted.current) setStats(null)
      })
      .finally(() => {
        if (mounted.current) setLoading(false)
      })
  }, [enabled])

  return { stats, loading }
}
