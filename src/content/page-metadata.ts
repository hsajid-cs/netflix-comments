import { METADATA_REQUEST, METADATA_SOURCE, readPlaybackMetadata } from './detector/playback-metadata'

// This entry runs in the page world, where Netflix's player metadata and cache
// is visible. Only public title IDs/names cross to the isolated UI; no account
// information, credentials, API requests or player controls are exposed.
let lastPublished = ''
let lastDiagnostic = ''
function publishMetadata() {
  const episodeId = location.pathname.match(/^\/watch\/(\d+)/)?.[1]
  if (!episodeId) { lastPublished = ''; return }
  const page = window as Window & { netflix?: unknown }
  const metadata = readPlaybackMetadata(page.netflix, episodeId)
  const diagnostic = JSON.stringify(metadata ?? { episodeId, status: 'unavailable' })
  if (diagnostic !== lastDiagnostic) {
    lastDiagnostic = diagnostic
    console.info('[Netflix Comments] playback metadata:', diagnostic)
  }
  if (!metadata) { lastPublished = ''; return }
  const key = JSON.stringify(metadata)
  if (key === lastPublished) return
  lastPublished = key
  window.postMessage({ source: METADATA_SOURCE, ...metadata }, location.origin)
}

window.addEventListener(METADATA_REQUEST, () => { lastPublished = ''; publishMetadata() })
// Netflix hydrates player metadata asynchronously and replaces it during navigation.
setInterval(publishMetadata, 1000)
publishMetadata()
