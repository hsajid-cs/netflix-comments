import type { NetflixTitleState } from '../shared/types'

export type DiscussionScope = 'episode' | 'series'

/** Human-readable playback identity; missing metadata is never guessed. */
export function episodeLabel(title: NetflixTitleState): string {
  const position = [
    title.seasonNumber != null ? `S${title.seasonNumber}` : '',
    title.episodeNumber != null ? `E${title.episodeNumber}` : '',
  ].filter(Boolean).join(' ')
  return [position, title.episodeName].filter(Boolean).join(' · ') || 'This episode'
}

/** Unknown series metadata must never silently redirect to an episode thread. */
export function discussionId(title: NetflixTitleState, scope: DiscussionScope): string | null {
  return scope === 'episode' ? title.episodeId ?? null : title.seriesId ?? null
}

/** Unknown playback is guarded too; a brief missing player must not reveal spoilers. */
export function hideFutureComment(stamp: number | null, playback: number | null): boolean {
  return stamp != null && (playback == null || !Number.isFinite(playback) || stamp > playback)
}
