import type { Comment } from '../shared/types'

export interface ActivityBucket { count: number; seconds: number | null }

/** Only actual, live timestamped comments contribute to the episode activity strip. */
export function commentActivity(comments: Comment[], duration: number, size = 40): ActivityBucket[] {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isInteger(size) || size <= 0) return []
  const buckets: ActivityBucket[] = Array.from({ length: size }, () => ({ count: 0, seconds: null }))
  for (const comment of comments) {
    const stamp = comment.videoTimeSeconds
    if (comment.deletedAt || stamp == null || !Number.isFinite(stamp) || stamp < 0 || stamp > duration) continue
    const bucket = buckets[Math.min(size - 1, Math.floor(stamp / duration * size))]
    bucket.count++
    bucket.seconds = bucket.seconds == null ? stamp : Math.min(bucket.seconds, stamp)
  }
  return buckets
}
