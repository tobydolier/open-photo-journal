# FrameFeed security patch status — 2026-11-15

Phase-one application hardening prepared:
- Remove unsigned identity-header authentication; password plus signed, database-backed revocable session only.
- Require same-origin login/logout; cap login body and rate-limit five valid-shaped attempts per 15 minutes per Cloudflare client IP (additional edge/global limits remain necessary).
- Restrict media reads to objects referenced by posts, allowlist MIME types, shorten public cache lifetime, set same-site resource policy. Published posts remain public. Profile-image route remains separately public.
- Check image signatures rather than trusting client MIME declarations. Signature checks are not a full decoder or malware scan.
- Add baseline response headers and partial CSP; strict script CSP is outstanding.
- Add Dependabot configuration and PR build verification.
- Old sessions will be invalidated. Tables admin_sessions/admin_login_limits are created at runtime. Verify D1 schema permissions and password secrets before deployment. Hosted preview email-only access is no longer supported by this auth path.

Urgent dependency targets (must regenerate pnpm lockfile from registry and test; not yet applied):
- react-server-dom-webpack >=19.2.9, compatible react/react-dom versions; GHSA-xqc2-xf4c-x3h3 and GHSA-h3gv-c5rc-p453.
- @vitejs/plugin-rsc >=0.5.38, GHSA-59pf-q495-3c99; plugin vendors its own RSC copy.
- next and eslint-config-next >=16.4.5, GHSA-f3mh-rxg3-f5g2 and other November 2026 advisories.
- Review vinext 1.4.4 compatibility with current build tooling, and all transitive advisories via pnpm audit.

Acceptance checks on staging: logged-out owner API access denied even with arbitrary identity headers; correct password signs in; logout revokes replay of its own cookie; 6th login attempt receives 429; different origin denied; current grid/media/thumbnail/frames/ordering/import/profile/short links work; non-post object denied; upload format validation; verify browser/Turnstile behavior. No destructive tests on production. Review Cloudflare WAF, budgets, secrets, backups. Actual total bucket quota enforcement, tenant isolation and full penetration testing outstanding.

No claim of completed testing, deployed fixes, or absence of compromise.
