# FrameFeed featured photographs from the existing feed

Implementation committed. As of this commit, these are code changes, not a claim of live deployment or completed migration.

## One-time database setup

Open Cloudflare > D1 > **framefeed-db** > Console. Execute the SQL from `drizzle/0003_featured_photos.sql`:

```sql
CREATE TABLE IF NOT EXISTS featured_photos (
  slot INTEGER PRIMARY KEY NOT NULL CHECK (slot BETWEEN 0 AND 2),
  post_id TEXT NOT NULL,
  media_key TEXT NOT NULL
);
```

This can be run repeatedly without deleting content.

For the independently implemented Arrange Posts feature, also apply `drizzle/0002_manual_post_order.sql` once **if not already applied**:

```sql
ALTER TABLE posts ADD COLUMN sort_order INTEGER;
CREATE INDEX IF NOT EXISTS idx_posts_manual_order ON posts(sort_order);
```

The ALTER will fail if the column already exists; check `PRAGMA table_info(posts)` before applying it twice. This migration is separate from featured photos.

## Selecting photos (after Cloudflare photo migration)

1. Sign in as the photo journal owner at the Cloudflare Worker or `toby.framefeed.co.uk`.
2. In the feed, navigate through the carousel to the exact photo.
3. Use **Feature in homepage frame** dropdown and choose **Gallery White**, **Carved Mahogany**, or **Black Box**.
4. Repeat for the other two frames. Choosing a frame slot again replaces that slot's choice, without changing or duplicating the underlying photo.
5. Visit `/welcome` or `framefeed.co.uk` once domains are connected.

Public endpoint `GET /api/landing-photos` returns only curated media keys that still belong to existing posts. The owner-only `PUT` endpoint authenticates the admin session, rejects cross-origin modifications, and checks post/media membership. No photographs are uploaded or duplicated. If the featured-photos table does not exist yet, the landing page uses placeholders.

**Important:** the original ChatGPT Sites journal and the newly deployed Cloudflare journal do not yet share the same D1 database or R2 bucket. Photos that are only present in the original app will not appear on the new site's landing page until they are migrated. This feature does not automatically read the original application's storage.

For now, only display photos with the owner's permission on the public landing page (avoid images of people).
