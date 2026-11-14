-- Add the separate ornate mahogany style while retaining every saved frame.
CREATE TABLE photo_frames_with_ornate (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL,
  media_key TEXT NOT NULL,
  style TEXT NOT NULL CHECK (style IN ('white','mahogany','ornate','black','pine'))
);

INSERT INTO photo_frames_with_ornate (id, post_id, media_key, style)
SELECT id, post_id, media_key, style FROM photo_frames;

DROP TABLE photo_frames;
ALTER TABLE photo_frames_with_ornate RENAME TO photo_frames;
CREATE INDEX idx_photo_frames_post ON photo_frames(post_id);
