import type { NetflixTitleState } from '../shared/types'
import { parseNetflixPath } from './detector/parse-location'
import { resolveEpisodeMetadata, resolveSeriesId, resolveTitleName } from './detector/resolve-title-name'
import { METADATA_REQUEST, mergePlaybackMetadata, parsePlaybackMetadata, type PlaybackMetadata } from './detector/playback-metadata'

export interface NetflixDetector {
  getState(): NetflixTitleState
  subscribe(listener: (state: NetflixTitleState) => void): () => void
  /** Current playback position in seconds, or null if there's no usable <video>. */
  getVideoTime(): number | null
  /**
   * Subscribe to playback-position changes for the current <video>. Fires
   * immediately on subscribe, the instant a seek starts (not when it finishes
   * buffering), on play/pause/end and whenever a <video> is swapped in, and
   * roughly once a second during playback; also polled on an interval as a
   * safety net. The listener receives null when there's no usable <video>.
   * Returns an unsubscribe function.
   */
  subscribeTime(listener: (seconds: number | null) => void): () => void
  /** Total runtime in seconds of the current <video>, or null. */
  getVideoDuration(): number | null
  /** Seek the player to `seconds` (clamped to the video's duration). No-op if there's no <video>. */
  seekTo(seconds: number): void
  destroy(): void
}

/**
 * How strongly a <video> looks like the one the user is watching. Netflix keeps
 * extra <video>s around (a muted browse-page preview, a pre-buffered next
 * episode) that are hidden or tiny, so on-screen coverage is the anchor signal:
 * a hidden element can never outrank a visible one, even while the visible
 * player is paused or rebuffering. Among visible candidates, playing beats
 * paused and audible beats muted, each worth as much as filling the viewport.
 * `readyState` is deliberately not consulted — it dips during every rebuffer
 * (notably right after a seek) and would flip the pick to the wrong element.
 */
function scoreVideo(v: HTMLVideoElement): number {
  if (!v.isConnected) return Number.NEGATIVE_INFINITY
  const rect = v.getBoundingClientRect()
  const area = rect.width * rect.height
  if (area <= 0) return -1
  const coverage = Math.min(1, area / Math.max(1, window.innerWidth * window.innerHeight))
  const playing = !v.paused && !v.ended ? 1 : 0
  const audible = v.muted ? 0 : 1
  return playing + audible + coverage * 2
}

/**
 * The <video> the user is actually watching, or null. `<video>` is a web
 * standard, not Netflix markup — reading it doesn't cross the "no
 * Netflix-specific DOM" line the detector otherwise holds.
 */
function pickVideo(): HTMLVideoElement | null {
  let best: HTMLVideoElement | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (const v of document.querySelectorAll('video')) {
    const score = scoreVideo(v)
    if (score > bestScore) {
      best = v
      bestScore = score
    }
  }
  return best
}

function computeState(metadata: PlaybackMetadata | null = null): NetflixTitleState {
  const { pageType, titleId: urlId } = parseNetflixPath(location.pathname)

  const structured = pageType === 'watch' && urlId ? resolveEpisodeMetadata(document, urlId) : null
  const playback = mergePlaybackMetadata(pageType === 'watch' && metadata?.episodeId === urlId ? metadata : null, structured)
  const seriesId = pageType === 'watch' ? playback?.seriesId ?? resolveSeriesId(document, urlId) : urlId
  const titleId = pageType === 'watch' ? (seriesId ?? urlId) : urlId
  const titleName = pageType === 'browse' ? null : playback?.titleName ?? resolveTitleName()

  return {
    pageType, titleId, episodeId: pageType === 'watch' ? urlId : null, seriesId, titleName,
    episodeName: playback?.episodeName ?? null,
    seasonNumber: playback?.seasonNumber ?? null,
    episodeNumber: playback?.episodeNumber ?? null,
    url: location.href,
  }
}

function statesEqual(a: NetflixTitleState, b: NetflixTitleState): boolean {
  return a.pageType === b.pageType && a.titleId === b.titleId && a.episodeId === b.episodeId &&
    a.seriesId === b.seriesId && a.titleName === b.titleName && a.url === b.url &&
    a.episodeName === b.episodeName && a.seasonNumber === b.seasonNumber && a.episodeNumber === b.episodeNumber
}

// After a route change Netflix updates <title>/<meta> asynchronously, sometimes
// hundreds of ms later, and sometimes by replacing nodes wholesale rather than
// mutating text. Re-check on this schedule for a few seconds so the title name
// (and a late-resolving series id) settle without continuous polling.
const SETTLE_DELAYS_MS = [150, 400, 900, 1800, 3500]

/**
 * Tracks which Netflix title (if any) the user is currently viewing.
 *
 * Resilient to Netflix DOM changes by design: page type and id come from the
 * URL (`parseNetflixPath`); parent series and names use the page-world metadata
 * bridge, with standard web metadata as a fallback. No player markup is scraped.
 * Reacts to SPA navigation via the Navigation API (Chromium-only, which
 * is all this extension targets), plus a bounded settle timer and a broad-but-
 * cheap `<head>` observer to catch late/wholesale metadata swaps.
 */
export function createNetflixDetector(): NetflixDetector {
  const listeners = new Set<(state: NetflixTitleState) => void>()
  let current = computeState()
  let playbackMetadata: PlaybackMetadata | null = null
  let settleTimers: ReturnType<typeof setTimeout>[] = []
  let rafId = 0

  // ---- Playback-time tracking (for the spoiler guard) ----------------------
  // Media events don't bubble, but they still travel the capture phase from
  // document down, so a single capturing listener on `document` catches them
  // from whichever <video> is live. The interval is a safety net for anything
  // that changes without an event.
  const timeListeners = new Set<(seconds: number | null) => void>()
  let timePoll: ReturnType<typeof setInterval> | undefined
  let lastTimeKey: number | null | undefined

  function readVideoTime(): number | null {
    const t = pickVideo()?.currentTime
    return typeof t === 'number' && Number.isFinite(t) ? t : null
  }

  function emitTime(force: boolean) {
    const t = readVideoTime()
    const key = t == null ? null : Math.floor(t)
    if (!force && key === lastTimeKey) return
    lastTimeKey = key
    for (const listener of timeListeners) listener(t)
  }

  const onTimeUpdate = () => emitTime(false)
  const onPlaybackChange = () => emitTime(true)
  // `seeking` fires the moment currentTime jumps; `seeked` only once the new
  // position has buffered, which on Netflix can lag by seconds after a scrub.
  // The rest catch a play/pause/end and a <video> being swapped in or torn down.
  const FORCED_EVENTS = ['seeking', 'seeked', 'play', 'playing', 'pause', 'ended', 'emptied', 'loadedmetadata']
  const TIME_POLL_MS = 1000

  function startTimeTracking() {
    document.addEventListener('timeupdate', onTimeUpdate, true)
    for (const type of FORCED_EVENTS) document.addEventListener(type, onPlaybackChange, true)
    timePoll = setInterval(() => emitTime(false), TIME_POLL_MS)
  }

  function stopTimeTracking() {
    document.removeEventListener('timeupdate', onTimeUpdate, true)
    for (const type of FORCED_EVENTS) document.removeEventListener(type, onPlaybackChange, true)
    if (timePoll) clearInterval(timePoll)
    timePoll = undefined
    lastTimeKey = undefined
  }

  function emit(next: NetflixTitleState) {
    if (statesEqual(current, next)) return
    current = next
    for (const listener of listeners) listener(current)
  }

  // Coalesce bursts (rapid navigations, observer floods) into one check per frame.
  function refresh() {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      emit(computeState(playbackMetadata))
    })
  }

  function scheduleSettle() {
    for (const t of settleTimers) clearTimeout(t)
    settleTimers = SETTLE_DELAYS_MS.map((d) => setTimeout(refresh, d))
  }

  function onNavigate() {
    playbackMetadata = null
    refresh()
    scheduleSettle()
    window.dispatchEvent(new Event(METADATA_REQUEST))
  }

  function onMetadata(event: MessageEvent) {
    if (event.source !== window || event.origin !== location.origin) return
    const { pageType, titleId } = parseNetflixPath(location.pathname)
    if (pageType !== 'watch' || !titleId) return
    const metadata = parsePlaybackMetadata(event.data, titleId)
    if (!metadata) return
    playbackMetadata = metadata
    refresh()
  }

  window.addEventListener('message', onMetadata)
  window.dispatchEvent(new Event(METADATA_REQUEST))
  scheduleSettle()

  window.navigation?.addEventListener('navigate', onNavigate)
  // Fallback for environments/paths where the Navigation API doesn't fire.
  window.addEventListener('popstate', onNavigate)

  const head = document.querySelector('head')
  const headObserver = head ? new MutationObserver(refresh) : null
  headObserver?.observe(head!, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['content', 'href'] })

  return {
    getState: () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getVideoTime() {
      return readVideoTime()
    },
    subscribeTime(listener) {
      timeListeners.add(listener)
      if (timeListeners.size === 1) startTimeTracking()
      const t = readVideoTime()
      lastTimeKey = t == null ? null : Math.floor(t)
      listener(t)
      return () => {
        timeListeners.delete(listener)
        if (timeListeners.size === 0) stopTimeTracking()
      }
    },
    getVideoDuration() {
      const d = pickVideo()?.duration
      return typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : null
    },
    seekTo(seconds) {
      const video = pickVideo()
      if (!video) return
      const max = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : seconds
      video.currentTime = Math.max(0, Math.min(seconds, max))
    },
    destroy() {
      window.navigation?.removeEventListener('navigate', onNavigate)
      window.removeEventListener('popstate', onNavigate)
      window.removeEventListener('message', onMetadata)
      headObserver?.disconnect()
      for (const t of settleTimers) clearTimeout(t)
      if (rafId) cancelAnimationFrame(rafId)
      stopTimeTracking()
      timeListeners.clear()
      listeners.clear()
    },
  }
}
