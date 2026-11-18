import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tracks whether a scroll container has content hidden above / below the
 * viewport, so the caller can fade the top/bottom edges. rAF-throttled; also
 * re-measures on resize and whenever `deps` change (e.g. the list grew).
 */
export function useScrollShadows(deps: unknown[] = []) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [edges, setEdges] = useState({ top: false, bottom: false })
  const frame = useRef(0)

  const measure = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const el = ref.current
      if (!el) return
      const top = el.scrollTop > 2
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2
      setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }))
    })
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
      if (frame.current) cancelAnimationFrame(frame.current)
      frame.current = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps])

  return { ref, edges, measure }
}
