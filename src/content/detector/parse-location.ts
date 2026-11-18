import type { NetflixPageType } from '../../shared/types'

// A /watch/<id> or /title/<id> segment with the numeric id captured.
const WATCH_OR_TITLE_RE = /\/(watch|title)\/(\d+)/
// The same segments but WITHOUT a usable id — Netflix is on a title-ish route
// yet the id we rely on isn't in the URL (DOM/URL scheme change, redirect in
// flight). We still want to show the panel, in its "can't identify" state,
// rather than silently disappearing.
const WATCH_OR_TITLE_NO_ID_RE = /\/(watch|title)(\/|$)/

/**
 * Determines page type and title id from the URL alone — the most robust
 * signal Netflix gives us, independent of DOM structure or timing.
 *
 * `pageType` is `'watch'` / `'title'` whenever the route looks like a title
 * page; `titleId` is null only when the id couldn't be read from the URL. A
 * genuine non-title route (home, genre, search, My List) is `'browse'`.
 */
export function parseNetflixPath(pathname: string): { pageType: NetflixPageType; titleId: string | null } {
  const match = pathname.match(WATCH_OR_TITLE_RE)
  if (match) {
    const [, segment, id] = match
    return { pageType: segment === 'watch' ? 'watch' : 'title', titleId: id }
  }

  const partial = pathname.match(WATCH_OR_TITLE_NO_ID_RE)
  if (partial) {
    return { pageType: partial[1] === 'watch' ? 'watch' : 'title', titleId: null }
  }

  return { pageType: 'browse', titleId: null }
}
