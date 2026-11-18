/** What kind of Netflix page the user is currently on. */
export type NetflixPageType = 'watch' | 'title' | 'browse'

/** Current Netflix navigation state, as determined by the content script's detector. */
export interface NetflixTitleState {
  pageType: NetflixPageType
  /** Netflix numeric title id. Null only when pageType is 'browse'. */
  titleId: string | null
  /** Exact /watch ID, kept separate from the parent series. */
  episodeId?: string | null
  /** Parent /title ID from page metadata; null when unavailable. */
  seriesId?: string | null
  /** Best-effort title name; may be null even when titleId is known. */
  titleName: string | null
  /** Current episode details, when supplied by playback metadata. */
  episodeName?: string | null
  seasonNumber?: number | null
  episodeNumber?: number | null
  url: string
}

/**
 * Wire contract for a comment as returned by the backend (see
 * server/src/models/comment.ts). Shared between the background service
 * worker (which performs the actual HTTP calls) and the UI, so both sides
 * agree on field names/shape without either owning the other's copy.
 */
export interface CommentBase {
  id: string
  netflixTitleId: string
  userId: string
  username: string
  text: string
  /** ISO 8601 timestamp string, as serialized by the backend. */
  createdAt: string
  likeCount: number
  disagreeCount: number
  parentCommentId: string | null
  /**
   * Playback position in whole seconds when the comment was posted on a Netflix
   * /watch page. Null for replies and comments made on a /title detail page.
   */
  videoTimeSeconds: number | null
  /** ISO timestamp of the last edit by the author, or null if never edited. */
  editedAt: string | null
  /**
   * ISO timestamp if the comment was soft-deleted — kept as a tombstone because
   * it still has replies. Null for live comments. A deleted comment comes back
   * with `text: ''`; the UI renders a "comment deleted" placeholder and hides
   * its actions, but still shows the replies beneath it.
   */
  deletedAt: string | null
}

/** Shape returned by GET /titles/{id}/comments: a base comment plus like/reply state. */
export interface Comment extends CommentBase {
  likedByMe: boolean
  disagreedByMe: boolean
  replies: Comment[]
}

export interface ReactionState {
  likeCount: number
  disagreeCount: number
  likedByMe: boolean
  disagreedByMe: boolean
}

/**
 * The signed-in account, as surfaced to the UI. This is the app's own identity
 * (see server/src/models/user.ts) — never a Netflix account. The auth token is
 * deliberately NOT part of this shape: it lives only in the background service
 * worker + chrome.storage.local and is never sent to the content script/UI.
 */
export interface AuthUser {
  id: string
  username: string
}

/**
 * Aggregate activity for the signed-in account, as returned by GET /me/stats
 * (mirrors server/src/models/user.ts `UserStats`). Powers the popup's
 * "Your activity" card. All counts, never any Netflix data.
 */
export interface UserStats {
  comments: number
  replies: number
  likesReceived: number
  likesGiven: number
  titles: number
}
