import { METADATA_SOURCE, parsePlaybackMetadata, type PlaybackMetadata } from './playback-metadata.ts'

// Strips a trailing " - Netflix" / " | Netflix"-style suffix that Netflix
// appends to document.title.
const TITLE_SUFFIX_RE = /\s*[-|]\s*Netflix\s*$/i

const TITLE_ID_RE = /\/title\/(\d+)/

/**
 * Best-effort title name from standard web metadata (not Netflix-specific
 * markup): the tab title, falling back to the og:title meta tag.
 */
export function resolveTitleName(doc: Document = document): string | null {
  const rawTitle = doc.title.trim()
  if (rawTitle) {
    const cleaned = rawTitle.replace(TITLE_SUFFIX_RE, '').trim()
    if (cleaned && !/^Netflix$/i.test(cleaned)) return cleaned
  }

  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim()
  const cleaned = ogTitle?.replace(TITLE_SUFFIX_RE, '').trim()
  return cleaned && !/^Netflix$/i.test(cleaned) ? cleaned : null
}

/** Only use structured data explicitly tied to the current watch ID. */
export function resolveEpisodeMetadata(doc: Document, episodeId: string): PlaybackMetadata | null {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data: unknown = JSON.parse(script.textContent ?? '')
      const nodes = Array.isArray(data) ? data : [data]
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue
        const graph = Array.isArray(node['@graph']) ? node['@graph'] : [node]
        for (const item of graph) {
          if (!item || typeof item !== 'object') continue
          const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']]
          if (!types.includes('TVEpisode')) continue
          const itemId = String(item.url ?? item['@id'] ?? '').match(/\/(?:watch|title)\/(\d+)(?:[/?#]|$)/)?.[1]
          if (itemId !== episodeId) continue
          const season = item.partOfSeason
          const series = item.partOfSeries ?? season?.partOfSeries
          const seriesUrl = typeof series === 'string' ? series : series?.url ?? series?.['@id']
          const seriesId = String(seriesUrl ?? '').match(TITLE_ID_RE)?.[1]
          const metadata = parsePlaybackMetadata({
            source: METADATA_SOURCE, episodeId, seriesId,
            titleName: series?.name,
            episodeName: item.name,
            seasonNumber: season?.seasonNumber,
            episodeNumber: item.episodeNumber,
          }, episodeId)
          if (metadata) return metadata
        }
      }
    } catch { /* JSON-LD may be incomplete during navigation. */ }
  }
  return null
}

/**
 * On a /watch/<videoId> page, videoId is often an episode id rather than the
 * series id. Attempt to recover the parent series id from standard metadata
 * (canonical link, og:url) that may point at /title/<seriesId>. Returns null
 * if metadata is unavailable. Never substitute the episode ID for the series.
 */
export function resolveSeriesId(doc: Document = document, episodeId: string | null = null): string | null {
  const episode = episodeId ? resolveEpisodeMetadata(doc, episodeId) : null
  if (episode) return episode.seriesId
  const canonicalHref = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')
  const ogUrl = doc.querySelector('meta[property="og:url"]')?.getAttribute('content')

  for (const url of [canonicalHref, ogUrl]) {
    const match = url?.match(TITLE_ID_RE)
    if (match && match[1] !== episodeId) return match[1]
  }

  return null
}
