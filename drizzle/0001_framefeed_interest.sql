-- FrameFeed early-interest list. Run against framefeed-db only.
-- Emails are stored solely for FrameFeed launch updates, with explicit consent.
CREATE TABLE IF NOT EXISTS interest_signups (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  consented_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
