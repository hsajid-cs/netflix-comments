// Minimal ambient typing for the subset of the Navigation API this extension
// uses. TS lib.dom.d.ts coverage for this API varies by TS version, so we
// declare only what we need rather than depending on it being present.
interface NavigateEvent extends Event {
  readonly navigationType: 'push' | 'replace' | 'reload' | 'traverse'
}

interface Navigation extends EventTarget {
  addEventListener(type: 'navigate', listener: (event: NavigateEvent) => void): void
  removeEventListener(type: 'navigate', listener: (event: NavigateEvent) => void): void
}

interface Window {
  navigation?: Navigation
}
