# FrameFeed landing — art direction

Design decision: polished art gallery, but welcoming and slightly playful. Platform landing at `framefeed.co.uk` is an **interest signup**, not open account registration. User's public archive is at `toby.framefeed.co.uk` once hostname routing and migration work.

## Palette

- Gallery wall / page background: `#F5F0E8` warm ivory.
- Surface / cards: `#FFFCF6` soft white.
- Primary type: `#252A27` deep charcoal, never absolute black.
- Muted text: `#706F68` warm grey.
- Accent / primary action: `#C7654D` terracotta.
- Secondary accent: `#849D91` muted sage.
- Fine rules: `#D8D0C4`.
- Gallery viewer backdrop: `#303331`.

## Hierarchy

1. Slim header: framefeed. wordmark, About, See a gallery.
2. Eyebrow: A NEW HOME FOR PHOTOGRAPHS.
3. Hero headline: **Your photographs deserve a little wall space.**
4. Short description: Save, frame and share your favourite moments, on your own gallery address.
5. Email-interest section labelled **Join the early list**. Never imply account has been created. Only enable when a real protected waitlist endpoint, privacy notice, and consent have been built.
6. Landscape-only preview gallery with no identifiable people, featuring at least two framed presentation styles (Gallery White + Carved Mahogany) and optionally Oak & Ivory.
7. CTA: **See Toby’s gallery** (disabled or labelled preview until hostname and photo migration are complete).
8. Minimal footer: privacy, contact, independent platform identity.

## Photo sourcing

Use the owner's original landscape photography when accessible, with explicit selection and permission. No identifiable people in images for the first version. No random stock images passed off as the owner's work. If images are not yet available, retain beautiful framed placeholders; choose images from the archive after migration. Preserve photo aspect ratios; frames are CSS/artwork overlays only.

## Feeling and interaction

- Space and generous margins like a curated exhibition.
- Distinctive serif headlines balanced with restrained sans-serif labels.
- Frame examples should feel tactile with realistic moulding and subtle shadows, not emoji/clipart.
- Light whimsy: asymmetrical gallery hanging, an understated colour accent, subtle hover motion.
- Responsive on iPad/mobile, no tiny text.
- No faux social proof or made-up signup counts.
- No automatic signup until privacy/security and email flows are ready.
- Avoid deploying homepage changes to the existing single-user photo journal root until hostname routing distinguishes apex domain from user subdomains.
