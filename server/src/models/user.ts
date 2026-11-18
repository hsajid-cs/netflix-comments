/**
 * Application-owned account identity. This is NOT a Netflix identity — no
 * Netflix id/cookie/token is ever represented here. Replaces the old
 * `models/dev-user.ts` stand-in.
 */
export interface AuthedUser {
  id: string
  username: string
}

/** Full `users` row as used server-side. `passwordHash` never leaves this layer. */
export interface User extends AuthedUser {
  passwordHash: string
  createdAt: string
}

/** Safe-to-serialize subset returned to clients. */
export interface PublicUser {
  id: string
  username: string
  createdAt: string
}

/** Shape of a row as returned directly by the `users` table (snake_case). */
export interface UserRow {
  id: string
  username: string
  password_hash: string
  created_at: string
}

export function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  }
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, username: user.username, createdAt: user.createdAt }
}

/** Aggregate activity for one account — powers the popup's "Your activity" card. */
export interface UserStats {
  /** Top-level comments this user has posted. */
  comments: number
  /** Replies this user has posted. */
  replies: number
  /** Total likes across all of this user's comments + replies. */
  likesReceived: number
  /** Likes this user has given to others' comments. */
  likesGiven: number
  /** Distinct Netflix titles this user has commented on. */
  titles: number
}

/** One-row result of the stats aggregate query (all columns come back as bigint → string). */
export interface UserStatsRow {
  comments: string
  replies: string
  likes_received: string
  likes_given: string
  titles: string
}

export function mapUserStatsRow(row: UserStatsRow): UserStats {
  return {
    comments: Number(row.comments),
    replies: Number(row.replies),
    likesReceived: Number(row.likes_received),
    likesGiven: Number(row.likes_given),
    titles: Number(row.titles),
  }
}
