-- Expand the original three-place featured-photo table into the nine-place
-- profile gallery, and add the natural pine frame without losing selections.
-- Run against framefeed-db, not FPL databases.

CREATE TABLE featured_photos_expanded (
  slot INTEGER PRIMARY KEY NOT NULL CHECK (slot BETWEEN 0 AND 8),
  post_id TEXT NOT NULL,
  media_key TEXT NOT NULL
);

INSERT INTO featured_photos_expanded (slot, post_id, media_key)
SELECT slot, post_id, media_key FROM featured_photos;

DROP TABLE featured_photos;
ALTER TABLE featured_photos_expanded RENAME TO featured_photos;

CREATE TABLE photo_frames_expanded (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL,
  media_key TEXT NOT NULL,
  style TEXT NOT NULL CHECK (style IN ('white','mahogany','black','pine'))
);

INSERT INTO photo_frames_expanded (id, post_id, media_key, style)
SELECT id, post_id, media_key, style FROM photo_frames;

DROP TABLE photo_frames;
ALTER TABLE photo_frames_expanded RENAME TO photo_frames;
CREATE INDEX idx_photo_frames_post ON photo_frames(post_id);
