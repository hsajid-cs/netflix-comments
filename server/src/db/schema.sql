CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Application-owned user accounts. Entirely independent of Netflix — no Netflix
-- id, cookie, or token is ever stored here. Only a chosen username and a bcrypt
-- password hash.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  netflix_title_id TEXT NOT NULL,
  -- Holds users.id (a UUID) as text. Kept TEXT rather than a FK so pre-auth dev
  -- rows (user_id = 'dev-user-1') don't break a re-migrate; app code always
  -- writes a real users.id now.
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  like_count INTEGER NOT NULL DEFAULT 0,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE
);

-- Playback position (whole seconds) the comment was posted at, when it was made
-- on a Netflix /watch page. NULL for replies and for comments made on a /title
-- detail page. Added via ALTER (not in the CREATE above) so an existing database
-- picks it up on a re-migrate — `CREATE TABLE IF NOT EXISTS` never alters.
ALTER TABLE comments ADD COLUMN IF NOT EXISTS video_time_seconds INTEGER;

-- Comment editing / deletion. `edited_at` is set every time the author changes
-- the text (drives an "edited" marker in the UI). `deleted_at` marks a
-- soft-deleted comment: its `text` is blanked but the row is kept as a
-- tombstone so a thread of replies underneath it stays intact. A comment with
-- no replies is hard-deleted instead (row removed), so `deleted_at` rows are
-- only ever the ones that still anchor a thread. Added via ALTER for the same
-- reason as the column above.
ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS disagree_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_comments_title ON comments(netflix_title_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

-- One mutually exclusive reaction per viewer. Existing likes remain likes.
ALTER TABLE comment_likes ADD COLUMN IF NOT EXISTS reaction TEXT NOT NULL DEFAULT 'like'
  CHECK (reaction IN ('like', 'disagree'));
