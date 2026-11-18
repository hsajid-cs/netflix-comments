export const METADATA_SOURCE = 'netflix-comments:playback-metadata'
export const METADATA_REQUEST = 'netflix-comments:request-metadata'

export interface PlaybackMetadata {
  episodeId: string
  seriesId: string | null
  titleName: string | null
  episodeName: string | null
  seasonNumber: number | null
  episodeNumber: number | null
}

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function unwrap(value: unknown): unknown {
  const node = record(value)
  return node && 'value' in node ? node.value : value
}

function numericId(value: unknown): string | null {
  return (typeof value === 'string' || typeof value === 'number') && /^\d+$/.test(String(value))
    ? String(value) : null
}

function seriesReference(value: unknown): string | null {
  const unwrapped = unwrap(value)
  if (Array.isArray(unwrapped)) {
    return unwrapped.length === 2 && unwrapped[0] === 'videos' ? numericId(unwrapped[1]) : null
  }
  return numericId(unwrapped) ?? numericId(record(unwrapped)?.id)
}

function name(value: unknown): string | null {
  const text = unwrap(value)
  return typeof text === 'string' && text.trim() ? text.trim().slice(0, 300) : null
}

function number(value: unknown): number | null {
  const raw = unwrap(value)
  const n = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null
}

function call(target: unknown, method: string, ...args: unknown[]): unknown {
  try {
    const fn = record(target)?.[method]
    return typeof fn === 'function' ? fn.apply(target, args) : null
  } catch { return null }
}

/**
 * Netflix's player owns hydrated metadata even when falcorCache has no watch ID.
 * Read only title metadata for that ID; never call playback or network methods.
 */
export function playbackMetadataFromPlayer(api: unknown, episodeId: string): PlaybackMetadata | null {
  if (!numericId(episodeId)) return null
  const metadata = call(api, 'getVideoMetadataByVideoId', Number(episodeId))
  const current = call(metadata, 'getCurrentVideo')
  const rawEpisode = record(record(current)?._video)
  const currentId = numericId(rawEpisode?.id)
  if (currentId && currentId !== episodeId) return null

  const video = record(record(call(metadata, 'getVideo'))?._video)
    ?? record(record(record(metadata)?._metadataObject)?.video)
  let matchedEpisode: Record<string, unknown> | null = null
  let matchedSeason: Record<string, unknown> | null = null
  if (Array.isArray(video?.seasons)) {
    for (const item of video.seasons) {
      const season = record(item)
      if (!Array.isArray(season?.episodes)) continue
      const found = season.episodes.find(item => numericId(record(item)?.id) === episodeId)
      if (found) { matchedEpisode = record(found); matchedSeason = season; break }
    }
  }
  // Raw season lists must contain the requested episode. Methods on the object
  // returned for that exact ID also support players that omit the raw list.
  if (!current && !matchedEpisode && numericId(video?.id) !== episodeId) return null
  const episodic = call(current, 'isEpisodic') === true || !!matchedEpisode || video?.type === 'show'
  const seriesId = episodic && (matchedEpisode || currentId === episodeId) ? numericId(video?.id) : null
  const season = record(record(call(current, 'getSeason'))?._season)
    ?? record(record(record(current)?._season)?._season)
  return parsePlaybackMetadata({
    source: METADATA_SOURCE, episodeId,
    seriesId: seriesId === episodeId ? null : seriesId,
    titleName: name(call(metadata, 'getTitle')) ?? name(call(current, 'getTitle')) ?? name(video?.title),
    episodeName: name(call(current, 'getEpisodeTitle')) ?? (episodic ? name(matchedEpisode?.title ?? rawEpisode?.title) : null),
    seasonNumber: episodic ? number(season?.seq) ?? number(matchedSeason?.seq) : null,
    episodeNumber: episodic ? number(call(current, 'getEpisodeNumber')) ?? number(matchedEpisode?.seq ?? rawEpisode?.seq) : null,
  }, episodeId)
}

/** Combine only metadata for the same episode and compatible parent IDs. */
export function mergePlaybackMetadata(primary: PlaybackMetadata | null, fallback: PlaybackMetadata | null): PlaybackMetadata | null {
  if (!primary) return fallback
  if (!fallback || primary.episodeId !== fallback.episodeId ||
    (primary.seriesId && fallback.seriesId && primary.seriesId !== fallback.seriesId)) return primary
  return {
    episodeId: primary.episodeId,
    seriesId: primary.seriesId ?? fallback.seriesId,
    titleName: primary.titleName ?? fallback.titleName,
    episodeName: primary.episodeName ?? fallback.episodeName,
    seasonNumber: primary.seasonNumber ?? fallback.seasonNumber,
    episodeNumber: primary.episodeNumber ?? fallback.episodeNumber,
  }
}

export function readPlaybackMetadata(netflix: unknown, episodeId: string): PlaybackMetadata | null {
  const root = record(netflix)
  const playerApp = record(record(root?.appContext)?.state)?.playerApp
  const player = playbackMetadataFromPlayer(call(playerApp, 'getAPI'), episodeId)
  return mergePlaybackMetadata(player, playbackMetadataFromCache(root?.falcorCache, episodeId))
}

/** Read only the currently playing video's relationship, never an unrelated cached show. */
export function playbackMetadataFromCache(cache: unknown, episodeId: string): PlaybackMetadata | null {
  const videos = record(record(cache)?.videos)
  const episode = record(videos?.[episodeId])
  if (!episode) return null
  const summary = record(unwrap(episode.summary))
  if (summary?.type === 'movie' || summary?.type === 'show') return null
  const seasonId = seriesReference(episode.season) ?? numericId(unwrap(episode.seasonId)) ?? numericId(summary?.seasonId)
  const season = seasonId ? record(videos?.[seasonId]) : null
  const seasonSummary = record(unwrap(season?.summary))
  const seriesId = seriesReference(episode.series) ?? seriesReference(episode.seriesId) ?? numericId(summary?.seriesId)
    ?? seriesReference(season?.series) ?? seriesReference(season?.seriesId) ?? numericId(seasonSummary?.seriesId)
  if (!seriesId || seriesId === episodeId) return null
  const series = record(videos?.[seriesId])
  return {
    episodeId, seriesId,
    titleName: name(series?.title),
    episodeName: name(episode.title),
    seasonNumber: number(episode.seasonNumber) ?? number(summary?.seasonNumber) ?? number(season?.seasonNumber),
    episodeNumber: number(episode.episodeNumber) ?? number(summary?.episodeNumber),
  }
}

/** The page world is untrusted; accept only the small, validated metadata contract. */
export function parsePlaybackMetadata(value: unknown, episodeId: string): PlaybackMetadata | null {
  const data = record(value)
  if (data?.source !== METADATA_SOURCE || data.episodeId !== episodeId) return null
  const seriesId = numericId(data.seriesId)
  if (data.seriesId !== null && (!seriesId || seriesId === episodeId)) return null
  const result = {
    episodeId, seriesId,
    titleName: name(data.titleName),
    episodeName: name(data.episodeName),
    seasonNumber: number(data.seasonNumber),
    episodeNumber: number(data.episodeNumber),
  }
  return result.seriesId != null || result.titleName != null || result.episodeName != null ||
    result.seasonNumber != null || result.episodeNumber != null ? result : null
}
