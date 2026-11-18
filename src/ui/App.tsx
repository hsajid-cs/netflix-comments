import { useEffect, useState } from 'react'
import type { NetflixDetector } from '../content/netflix-detector'
import CommentsPanel from './components/CommentsPanel'
import ErrorBoundary from './ErrorBoundary'

export default function App({ detector }: { detector: NetflixDetector }) {
  const [state, setState] = useState(detector.getState())
  const [videoTime, setVideoTime] = useState<number | null>(null)

  useEffect(() => detector.subscribe(setState), [detector])

  // Track the playback position only on a /watch page; it feeds the panel's
  // spoiler guard (comments stamped ahead of where you are get blurred).
  useEffect(() => {
    if (state.pageType !== 'watch') {
      setVideoTime(null)
      return
    }
    return detector.subscribeTime(setVideoTime)
  }, [detector, state.pageType, state.episodeId])

  // Nothing to discuss on the home grid / genre rows / search.
  if (state.pageType === 'browse') return null

  return (
    // Reset the boundary and its panel on title changes so drafts, replies,
    // spoiler reveals, and in-flight state stay scoped to a single title.
    <ErrorBoundary key={`${state.pageType}:${state.episodeId ?? state.titleId ?? 'undetected'}`}>
      <CommentsPanel
        title={state}
        isWatch={state.pageType === 'watch'}
        currentVideoTime={videoTime}
        videoDuration={state.pageType === 'watch' ? detector.getVideoDuration() : null}
        getVideoTime={() => detector.getVideoTime()}
        onSeek={(seconds) => detector.seekTo(seconds)}
      />
    </ErrorBoundary>
  )
}
