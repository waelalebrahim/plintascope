-- PlintaScope community board schema.
-- Run this ONCE in the Cloudflare D1 console (Storage & Databases -> your DB -> Console).

CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT    NOT NULL DEFAULT 'idea',   -- 'idea' or 'feedback'
  name       TEXT,                              -- optional display name
  email      TEXT    NOT NULL,                  -- required, never shown publicly
  message    TEXT    NOT NULL,
  votes      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL                   -- unix seconds
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at);

-- Replies to posts (one level deep). Added later; run these to enable replies.
CREATE TABLE IF NOT EXISTS replies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL,                  -- the post this reply belongs to
  name       TEXT,                              -- optional display name
  email      TEXT    NOT NULL,                  -- required, never shown publicly
  message    TEXT    NOT NULL,
  created_at INTEGER NOT NULL                   -- unix seconds
);

CREATE INDEX IF NOT EXISTS idx_replies_post ON replies (post_id, created_at);
