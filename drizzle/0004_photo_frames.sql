-- Per-photo frame styles used consistently in the feed and full-screen viewer.
CREATE TABLE IF NOT EXISTS photo_frames (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL,
  media_key TEXT NOT NULL,
  style TEXT NOT NULL CHECK (style IN ('white','mahogany','black'))
);
CREATE INDEX IF NOT EXISTS idx_photo_frames_post ON photo_frames(post_id);
