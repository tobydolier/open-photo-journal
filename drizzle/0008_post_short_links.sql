-- Permanent compact links for sharing posts through an optional short domain.
CREATE TABLE IF NOT EXISTS post_short_links (
  code TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_post_short_links_post ON post_short_links(post_id);
