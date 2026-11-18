import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/**
 * Last line of defence: if anything in the panel throws while rendering (an
 * unexpected data shape, a Netflix-side surprise), swallow it so we degrade to
 * a tiny relaunch affordance instead of leaving a broken tree — or worse,
 * bubbling an error into Netflix's own page.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError(): { crashed: boolean } {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[netflix-comments] panel render error', error, info)
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <button
        type="button"
        className="nc-launcher"
        onClick={() => this.setState({ crashed: false })}
        aria-label="Reload comments panel"
      >
        <span className="nc-launcher-icon" aria-hidden="true">
          ↻
        </span>
        Reload comments
      </button>
    )
  }
}
