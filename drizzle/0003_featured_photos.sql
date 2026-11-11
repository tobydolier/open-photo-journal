-- FrameFeed curated featured photos: one media entry from an existing post per frame.
-- Run against framefeed-db, not FPL databases.
CREATE TABLE IF NOT EXISTS featured_photos (
  slot INTEGER PRIMARY KEY NOT NULL CHECK (slot BETWEEN 0 AND 2),
  post_id TEXT NOT NULL,
  media_key TEXT NOT NULL
);
