import { useCallback, useEffect, useRef, useState } from 'react'
import { PANEL_PREFS_KEY } from '../../shared/constants'

export interface PanelPrefs {
  open: boolean
  minimized: boolean
}

/**
 * Persists the panel's open/minimized layout in `chrome.storage.local` so that
 * closing it (or collapsing it) survives navigation between titles and browser
 * restarts — reopening restores the same state instead of snapping to defaults.
 *
 * `defaults` supplies the first-run value (e.g. start minimized on /watch).
 * Until storage has been read, `hydrated` is false so callers can hold first
 * paint and avoid a visible flip.
 */
export function usePanelPrefs(defaults: PanelPrefs) {
  const [prefs, setPrefs] = useState<PanelPrefs>(defaults)
  const [hydrated, setHydrated] = useState(false)
  const defaultsRef = useRef(defaults)
  const prefsRef = useRef(prefs)

  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(() => chrome.storage.local.get(PANEL_PREFS_KEY))
      .then((stored) => {
        if (cancelled) return
        const saved = stored[PANEL_PREFS_KEY] as Partial<PanelPrefs> | undefined
        const next = {
          open: typeof saved?.open === 'boolean' ? saved.open : defaultsRef.current.open,
          minimized: typeof saved?.minimized === 'boolean' ? saved.minimized : defaultsRef.current.minimized,
        }
        prefsRef.current = next
        setPrefs(next)
      })
      .catch(() => {
        /* storage unavailable — keep defaults */
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback((patch: Partial<PanelPrefs>) => {
    const next = { ...prefsRef.current, ...patch }
    prefsRef.current = next
    setPrefs(next)
    try {
      void chrome.storage.local.set({ [PANEL_PREFS_KEY]: next }).catch(() => {})
    } catch {
      // Layout still works if an extension reload invalidated this context.
    }
  }, [])

  return { prefs, hydrated, update }
}
