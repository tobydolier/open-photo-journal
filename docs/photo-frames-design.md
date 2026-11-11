# FrameFeed photo frames — design and implementation specification

Status: Approved design proposal, NOT yet implemented.

## Three initial frame choices

1. **Gallery White** — fine off-white mount, narrow warm-white outer frame, subtle depth and shadow. Restrained, photographic default.
2. **Oak & Ivory** — natural pale-oak outer frame, larger ivory mount, soft shadow. Warm traditional gallery display.
3. **Black Box** — slim matte-charcoal frame, deep-black mount, small separation gap. Contemporary dramatic display.

Optional `none` setting preserves unframed originals. Never bake frames into stored images; frame treatments are CSS presentation around the original image. Preserve source aspect ratio; do not crop except existing feed thumbnail rules.

## Behaviour

- Every media item (not merely each post) has its own frame choice. Carousel images may differ.
- Only the authenticated **owner of that item** can change its frame, using a dropdown on the photo editing screen: No frame / Gallery White / Oak & Ivory / Black Box.
- Save changes immediately or with an explicit Save action; updates persist across devices and refreshes.
- All visitors see the current selection in feed, grid as appropriate, and post detail.
- Clicking/tapping a photo opens an accessible fullscreen or near-fullscreen lightbox: large framed image centered on a quiet neutral gallery wall; aspect ratio preserved; surrounding space, not full bleed.
- Lightbox: close button, Escape, click-backdrop close, swipe/arrow navigation across carousel, keyboard arrow navigation, image loading states, caption/credit, accessible dialog focus management; avoid overflow on phones.
- Frame size/mount proportions scale responsively and shrink to viewport to keep image fully visible.
- Individual post permanent URLs and Open Graph cards continue to show the **original photo**, unless a later explicit decision requests rendered-frame social previews.

## Persistence and authorisation

Current schema has a `posts` table with a JSON `media` field. Implement frame setting per media entry in the existing JSON shape if backwards compatible, or a normalised media table if multi-user changes warrant it. Existing entries without a frame must default to `none`, so historical posts keep their current appearance.

Do not overwrite the production D1 schema with the initial schema: make a forward-only migration, with D1 backup and rollback procedure.

A server-side mutation must:
1. authenticate the session (no trust in caller-supplied identity);
2. resolve a post ID + specific media ID/index;
3. verify the owner of the post/photo equals the authenticated account;
4. validate frame choice against a strict allowlist;
5. update only that media entry;
6. return updated state and ensure cache refresh.

Important: the current app is single-owner and public signup is not implemented. Do not enable multi-user editing until account ownership and authorisation exist.

## Design tokens (initial suggestions)

- Gallery White: outer 10px #f6f4ef; inset mount 24px #faf9f5; subtle border #d8d5cc and gentle shadow.
- Oak & Ivory: outer 14px warm wood-tone #a77c53 with grain-free clean finish; inner ivory mount 32px #f5f0e4; light bevel + shadow.
- Black Box: outer 10px #202020; mount 24px #101010; narrow #3b3b3b bevel and deeper shadow.

These values are responsive targets, not fixed pixels on small screens.

## Acceptance tests

- Non-owner cannot see edit control or successfully submit its API mutation.
- Selection persists after reload on a different device.
- Carousel frames are independent.
- Existing unframed posts remain visually unchanged.
- Clicking any framed image opens a correctly sized and accessible lightbox showing the same frame.
- Mobile viewport keeps full photo and frame visible.
- Feed layout never jumps during loading.
- No photo bytes are changed or duplicated in R2.
