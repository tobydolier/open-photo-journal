# FrameFeed deployment architecture (proposed)

Domain confirmed: framefeed.co.uk.

Provisioned Cloudflare resources (user confirmed):
- D1 database: `framefeed-db` — database ID `2d43ec6a-9a00-425e-8497-2495a55f2d65`, binding `DB`.
- R2 private bucket: `framefeed-media`, binding `BUCKET`.

The database ID is an identifier, not a credential. No Cloudflare API tokens, authentication secrets or private photo data belong in this repository.

## Hostnames
- `https://framefeed.co.uk/`: platform landing page; sign up and log in.
- `https://toby.framefeed.co.uk/`: Toby's public profile, post grid, feed and permanent post pages.
- `https://{username}.framefeed.co.uk/`: future member profiles, after multi-tenant support is implemented.

## Important gap
The current `open-photo-journal` v0.1 application describes itself as **one person's** photo journal. Its existing owner-only administration, D1 and R2 bindings, and import functionality are not a secure public user signup system. **Do not expose public signup until** account creation, email verification, authenticated sessions, unique username allocation, reserved subdomain checks, data isolation, per-user media ownership and authorisation, anti-abuse controls, and account deletion are implemented and tested.

## Safe rollout
1. Prepare a standalone Cloudflare Worker build in a separate branch. Preserve the current ChatGPT Sites deployment and its D1/R2 data.
2. Create a new D1 database and R2 bucket with the required bindings `DB` and `BUCKET`. Never deploy with placeholder IDs or commit secrets.
3. Create the platform landing page at the root, with a **coming soon / invitation-only** registration option until account support is built.
4. Implement hostname-to-profile routing and test `toby.framefeed.co.uk` on a staging Worker before DNS changes.
5. Migrate existing photos, captions, dates, and albums via a verified export/import procedure and reconcile counts. No automatic data sharing exists between ChatGPT Sites and standalone Cloudflare.
6. Add explicit Cloudflare Custom Domains for the apex and Toby's subdomain. Future arbitrary usernames may require wildcard DNS and Cloudflare-supported wildcard routing/certificates; confirm requirements before launch.
7. Only enable public registrations after account boundaries, moderation, storage quotas, privacy, emails and abuse-prevention are tested.

## Minimum checks before going live
- [ ] Standalone build runs
- [ ] Cloudflare bindings and secret configuration are correct
- [ ] Distinct landing and Toby profile pages
- [ ] Toby's historic posts/images verified
- [ ] Post share links, Open Graph, Bluesky sharing tested
- [ ] Unauthenticated users cannot write or view private administration
- [ ] Backup and rollback tested

Development notes: `README.md`, `vite.config.ts`, `.openai/hosting.json` and `.dev.vars.example` document the current app and binding constraints.
