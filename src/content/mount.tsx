import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { COMMENTS_ROOT_ID } from '../shared/constants'
import App from '../ui/App'
import type { NetflixDetector } from './netflix-detector'
// `?inline` returns the CSS as a string instead of Vite auto-injecting a
// <link> into the page <head>, which would leak our styles onto Netflix.
import panelStyles from '../styles/content.css?inline'

/**
 * Mounts the comments UI into an isolated Shadow DOM host appended to
 * <body>. Shadow DOM keeps our styles from leaking into Netflix's page and
 * keeps Netflix's styles/scripts from touching our UI or vice versa — the
 * Netflix page itself is never mutated beyond this single host element.
 */
export function mountCommentsUI(detector: NetflixDetector): void {
  if (document.getElementById(COMMENTS_ROOT_ID)) return

  const host = document.createElement('div')
  host.id = COMMENTS_ROOT_ID
  document.body.appendChild(host)

  const shadowRoot = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = panelStyles
  shadowRoot.appendChild(style)

  const appContainer = document.createElement('div')
  shadowRoot.appendChild(appContainer)

  createRoot(appContainer).render(
    <StrictMode>
      <App detector={detector} />
    </StrictMode>,
  )

  keepHostInFullscreenLayer(host)
}

/**
 * The Fullscreen API renders the fullscreen element (and only its DOM
 * subtree) in the browser's top layer, which sits above everything else in
 * the page — including a `position: fixed` sibling at max z-index. Without
 * this, our panel silently vanishes the moment Netflix's player goes
 * fullscreen. Re-parenting the host into whatever element is currently
 * fullscreen (and back to <body> on exit) keeps it visible and interactive
 * in both modes without disturbing Netflix's own fullscreen element.
 */
function keepHostInFullscreenLayer(host: HTMLElement): void {
  document.addEventListener('fullscreenchange', () => {
    const target = document.fullscreenElement ?? document.body
    if (host.parentElement !== target) target.appendChild(host)
  })
}
