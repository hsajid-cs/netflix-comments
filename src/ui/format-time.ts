/**
 * Format a playback position (seconds) the way a video scrubber does:
 * `m:ss`, or `h:mm:ss` once past an hour. Used by the composer's capture chip
 * and each comment's seek badge.
 */
export function formatVideoTime(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds))
  const s = whole % 60
  const m = Math.floor(whole / 60) % 60
  const h = Math.floor(whole / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
