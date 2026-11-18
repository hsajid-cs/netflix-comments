export interface Comment {
  id: string
  netflixTitleId: string
  userId: string
  username: string
  text: string
  createdAt: string
  likeCount: number
  disagreeCount: number
  parentCommentId: string | null
  /** Playback position in whole seconds if posted on a /watch page; null otherwise (replies, /title-page comments). */
  videoTimeSeconds: number | null
  /** Set when the author has edited the text at least once; null otherwise. */
  editedAt: string | null
  /** Set when the comment is soft-deleted (kept as a tombstone because it has replies); null otherwise. */
  deletedAt: string | null
}

export interface CommentWithReplies extends Comment {
  likedByMe: boolean
  disagreedByMe: boolean
  replies: CommentWithReplies[]
}

/** Shape of a row as returned directly by the `comments` table (snake_case). */
export interface CommentRow {
  id: string
  netflix_title_id: string
  user_id: string
  username: string
  text: string
  created_at: string
  like_count: number
  disagree_count: number
  parent_comment_id: string | null
  video_time_seconds: number | null
  edited_at: string | null
  deleted_at: string | null
}

export function mapCommentRow(row: CommentRow): Comment {
  return {
    id: row.id,
    netflixTitleId: row.netflix_title_id,
    userId: row.user_id,
    username: row.username,
    text: row.text,
    createdAt: row.created_at,
    likeCount: row.like_count,
    disagreeCount: row.disagree_count,
    parentCommentId: row.parent_comment_id,
    videoTimeSeconds: row.video_time_seconds,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
  }
}
