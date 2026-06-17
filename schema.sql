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
