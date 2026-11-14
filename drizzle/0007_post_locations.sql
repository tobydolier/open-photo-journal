CREATE TABLE IF NOT EXISTS post_locations (
  post_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL
);
