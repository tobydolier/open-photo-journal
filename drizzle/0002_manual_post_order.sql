-- Run once against framefeed-db before enabling manual post ordering.
-- Existing posts keep chronological order until explicitly reordered.
ALTER TABLE posts ADD COLUMN sort_order INTEGER;
CREATE INDEX IF NOT EXISTS idx_posts_manual_order ON posts(sort_order);
