export const COMMENTS_ROOT_ID = 'netflix-comments-root'

/**
 * Base URL of the comments backend (see `server/`). Only the background
 * service worker ever fetches this. Points at local dev for now — update
 * once the API is deployed (see server/.claude decisions for the intended
 * Render/Neon-Supabase free-tier target).
 */
export const API_BASE_URL = 'http://localhost:3000'

/**
 * Where the background worker persists the auth session ({ token, user }).
 * Exposed here (key + area only, never the value) so the UI can subscribe to
 * `chrome.storage.onChanged` and react when the popup logs in/out.
 */
export const AUTH_STORAGE_KEY = 'nc_auth'
export const AUTH_STORAGE_AREA = 'local' as const

/**
 * Where the panel persists its own open/minimized preference, so closing it and
 * navigating (or reopening later) restores the same layout instead of snapping
 * back to defaults. Value shape: `{ open: boolean; minimized: boolean }`.
 */
export const PANEL_PREFS_KEY = 'nc_panel_prefs'
