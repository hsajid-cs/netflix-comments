import type { PoolClient } from 'pg'
import { pool } from '../db/pool.js'
import { type Comment, type CommentRow, mapCommentRow } from '../models/comment.js'
import { type UserStats, type UserStatsRow, mapUserStatsRow } from '../models/user.js'

export interface CreateCommentParams {
  netflixTitleId: string
  userId: string
  username: string
  text: string
  parentCommentId: string | null
  videoTimeSeconds: number | null
}

export const commentsRepository = {
  async findByTitleId(netflixTitleId: string): Promise<Comment[]> {
    const result = await pool.query<CommentRow>(
      `SELECT * FROM comments WHERE netflix_title_id = $1 ORDER BY created_at ASC`,
      [netflixTitleId],
    )
    return result.rows.map(mapCommentRow)
  },

  async findById(id: string, client: PoolClient | typeof pool = pool): Promise<Comment | null> {
    const result = await client.query<CommentRow>(`SELECT * FROM comments WHERE id = $1`, [id])
    const row = result.rows[0]
    return row ? mapCommentRow(row) : null
  },

  async create(params: CreateCommentParams): Promise<Comment> {
    const result = await pool.query<CommentRow>(
      `INSERT INTO comments (netflix_title_id, user_id, username, text, parent_comment_id, video_time_seconds)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        params.netflixTitleId,
        params.userId,
        params.username,
        params.text,
        params.parentCommentId,
        params.videoTimeSeconds,
      ],
    )
    return mapCommentRow(result.rows[0])
  },

  /** True if any comment has this one as its parent (drives soft- vs hard-delete). */
  async hasReplies(id: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM comments WHERE parent_comment_id = $1 LIMIT 1`,
      [id],
    )
    return result.rowCount! > 0
  },

  /** Overwrites the text and stamps `edited_at`. Caller has verified existence + ownership. */
  async updateText(id: string, text: string): Promise<Comment> {
    const result = await pool.query<CommentRow>(
      `UPDATE comments SET text = $2, edited_at = now() WHERE id = $1 RETURNING *`,
      [id, text],
    )
    return mapCommentRow(result.rows[0])
  },

  /** Tombstones a comment that still anchors a thread: blanks the text, keeps the row. */
  async softDelete(id: string): Promise<Comment> {
    const result = await pool.query<CommentRow>(
      `UPDATE comments SET text = '', deleted_at = now() WHERE id = $1 RETURNING *`,
      [id],
    )
    return mapCommentRow(result.rows[0])
  },

  /** Removes a leaf comment entirely; comment_likes cascade. */
  async hardDelete(id: string): Promise<void> {
    await pool.query(`DELETE FROM comments WHERE id = $1`, [id])
  },

  /** One round-trip aggregate of everything the popup's "Your activity" card shows. */
  async statsForUser(userId: string): Promise<UserStats> {
    const result = await pool.query<UserStatsRow>(
      `SELECT
         COUNT(*) FILTER (WHERE c.parent_comment_id IS NULL)     AS comments,
         COUNT(*) FILTER (WHERE c.parent_comment_id IS NOT NULL) AS replies,
         COALESCE(SUM(c.like_count), 0)                          AS likes_received,
         COUNT(DISTINCT c.netflix_title_id)                      AS titles,
         (SELECT COUNT(*) FROM comment_likes cl WHERE cl.user_id = $1 AND cl.reaction = 'like') AS likes_given
       FROM comments c
       WHERE c.user_id = $1 AND c.deleted_at IS NULL`,
      [userId],
    )
    return mapUserStatsRow(result.rows[0])
  },

  async findReactionCommentIds(netflixTitleId: string, userId: string, reaction: 'like' | 'disagree'): Promise<Set<string>> {
    const result = await pool.query<{ comment_id: string }>(
      `SELECT cl.comment_id
       FROM comment_likes cl
       JOIN comments c ON c.id = cl.comment_id
       WHERE c.netflix_title_id = $1 AND cl.user_id = $2 AND cl.reaction = $3`,
      [netflixTitleId, userId, reaction],
    )
    return new Set(result.rows.map((row) => row.comment_id))
  },

  /** Serialize all reactions on the comment row and reconcile both counts atomically. */
  async toggleReaction(commentId: string, userId: string, reaction: 'like' | 'disagree') {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const locked = await client.query<CommentRow>(
        `SELECT * FROM comments WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [commentId],
      )
      if (!locked.rows[0]) {
        await client.query('ROLLBACK')
        return null
      }
      const existing = await client.query<{ reaction: 'like' | 'disagree' }>(
        `SELECT reaction FROM comment_likes WHERE comment_id = $1 AND user_id = $2`, [commentId, userId],
      )
      const active = existing.rows[0]?.reaction !== reaction
      await client.query(`DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2`, [commentId, userId])
      if (active) {
        await client.query(`INSERT INTO comment_likes (comment_id, user_id, reaction) VALUES ($1, $2, $3)`,
          [commentId, userId, reaction])
      }
      const updated = await client.query<CommentRow>(
        `UPDATE comments SET
           like_count = (SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1 AND reaction = 'like'),
           disagree_count = (SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1 AND reaction = 'disagree')
         WHERE id = $1 RETURNING *`, [commentId],
      )
      await client.query('COMMIT')
      return {
        likeCount: updated.rows[0].like_count,
        disagreeCount: updated.rows[0].disagree_count,
        likedByMe: active && reaction === 'like',
        disagreedByMe: active && reaction === 'disagree',
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
}
