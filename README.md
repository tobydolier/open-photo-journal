# Open Photo Journal

An open-source, self-hosted photo journal for one person. It provides a calm
public feed, a profile grid, permanent post pages, sharing cards, private owner
controls, resumable Instagram archive imports, and compressed photo uploads.

The application stores structured post data in Cloudflare D1 and display-sized
photographs in Cloudflare R2. Original photographs can remain in Apple Photos,
Lightroom, or wherever the owner already keeps them.

> This project is independent software. It is not affiliated with, endorsed by,
> or sponsored by Instagram or Meta. “Instagram” is used only to describe the
> optional archive-import format.

## What is included

- Public feed, grid, search, carousels, captions, dates, and source labels
- Permanent `/p/:id` post pages with Open Graph and Bluesky-ready metadata
- Owner-only create, delete, favourite, and archive-import controls
- HTML and JSON Instagram export import, with duplicate detection and resume
- Browser-side WebP resizing and re-encoding, which removes embedded EXIF/GPS
- Configurable name, profile, locale, storage ceiling, and canonical URL
- ChatGPT Sites or Cloudflare Access identity, with optional password login
- D1 schema and migrations, R2 media storage, per-photo frame styles, full-screen viewing, and an MIT licence

## Data boundary

The repository contains application code and an empty database schema only.
Photographs, captions, database contents, account details, passwords, and
deployment secrets must remain outside Git.

## Configuration

Copy `.dev.vars.example` to `.dev.vars` for local work. Do not commit the copied
file. Public presentation is controlled by environment variables:

| Variable | Purpose |
| --- | --- |
| `SITE_NAME` | The journal's public name |
| `SITE_DESCRIPTION` | Short description used in the interface and metadata |
| `PROFILE_NAME` | Owner's display name |
| `PROFILE_HANDLE` | Short public handle, without `@` |
| `PROFILE_BIO` | Profile introduction |
| `PROFILE_INITIAL` | One- or two-character avatar fallback |
| `SITE_EYEBROW` | Small heading above the main title |
| `SITE_LOCALE` | Date locale, such as `en-GB` |
| `VISIBILITY_LABEL` | Profile status text |
| `STORAGE_LIMIT_BYTES` | Application-level upload safety ceiling |
| `PUBLIC_SITE_URL` | Canonical production origin used by share cards |
| `WORDMARK_IMAGE_URL` | Optional root-relative or HTTPS wordmark/logo image |
| `PROFILE_IMAGE_URL` | Optional root-relative or HTTPS profile photograph |
| `FAVICON_URL` | Optional root-relative or HTTPS browser icon |
| `SHARE_IMAGE_URL` | Optional HTTPS default social-sharing image |

Choose one administrator method:

- `ADMIN_EMAIL`: trusts a matching identity header supplied by ChatGPT Sites or
  Cloudflare Access.
- `ADMIN_PASSWORD` plus `ADMIN_SESSION_SECRET`: enables the built-in owner login.

If neither method is configured, the site is safely read-only.

## Local development

Requirements: Node.js 22.13 or newer, pnpm 11, Git, and a Cloudflare-compatible
local runtime.

```bash
git clone https://github.com/tobydolier/open-photo-journal.git
cd open-photo-journal
pnpm install
cp .dev.vars.example .dev.vars
pnpm build
```

Apply the migrations to the local D1 database after the first build:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js \
  d1 execute DB --local --config dist/server/wrangler.json \
  --persist-to .wrangler/state --file drizzle/0000_outstanding_viper.sql

for migration in drizzle/0001_framefeed_interest.sql drizzle/0002_manual_post_order.sql drizzle/0003_featured_photos.sql drizzle/0004_photo_frames.sql drizzle/0005_expand_gallery_frames.sql; do
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js \
    d1 execute DB --local --config dist/server/wrangler.json \
    --persist-to .wrangler/state --file "$migration"
done
```

Then run:

```bash
pnpm dev
```

## Deployment

The present v0.1 deployment path is ChatGPT Sites, which provisions the D1 and
R2 bindings declared in `.openai/hosting.json`. The public template deliberately
contains no `project_id`: creating a new Site from the source assigns a fresh ID
and fresh data resources to that installation. Never copy a `project_id` from
another deployment.

The runtime is Cloudflare-native. Before the first production deployment, apply
`drizzle/0000_outstanding_viper.sql` through `drizzle/0005_expand_gallery_frames.sql`
to the production D1 database in numeric order. Configure `ADMIN_PASSWORD`
and `ADMIN_SESSION_SECRET` as runtime secrets rather than build variables.
Keep all passwords, account IDs, photographs, and deployment-specific values
outside this repository.

## Archive import

Download and extract an Instagram information archive, then select its outer
folder from the owner interface. The importer recognises `posts.html`,
`posts_1.html`, equivalent numbered files, and JSON exports. It preserves
captions, posting dates, and photo carousels. Unsupported videos, Stories, and
missing media are skipped. Re-selecting the same folder resumes safely.

## Licence

[MIT](LICENSE). You may use, modify, and redistribute the code. The licence does
not grant rights to anyone's photographs, captions, trademarks, or personal
data.
