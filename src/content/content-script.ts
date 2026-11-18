import { mountCommentsUI } from './mount'
import { createNetflixDetector } from './netflix-detector'
import { sendMessage } from '../shared/messaging'

// Entry point injected into netflix.com pages.
const detector = createNetflixDetector()
mountCommentsUI(detector)

detector.subscribe((state) => {
  void sendMessage({ type: 'TITLE_DETECTED', payload: state })
})
