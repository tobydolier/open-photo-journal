# FrameFeed roadmap — storage onboarding and security

## Storage onboarding (before public account registration)
- Investigate Cloudflare third-party OAuth availability, scopes, token lifecycle and eligibility; prove bucket provisioning and scoped R2 access with a test account.
- Design a guided account creation / R2 activation flow; users complete Cloudflare's own account and billing steps. Never promise automatic free account creation.
- Support bring-your-own-storage through provider adapters; start with R2 and direct HTTPS image URLs, evaluate ImageKit and other S3-compatible services.
- Store stable internal media IDs independent of provider; ensure portability, revocation, export and migration.
- Keep buckets private where possible; serve only explicitly public media; quantify proxy requests, bandwidth, cache and abuse costs. No broad account credentials or secrets in browsers/logs.

## Security gate — before public launch
- Inventory all routes, bindings, secrets, dependencies and deployment configurations; scan lockfile against known advisories (GitHub Dependabot, pnpm audit, OSV or equivalent), triage reachable issues and update/test fixes.
- Threat-model anonymous visitors, malicious accounts, stolen credentials, bots and compromised storage providers.
- Audit authentication, session signing, expiry, logout, CSRF, login rate limits, trusted proxy headers and account recovery.
- Verify every read/write route enforces tenant ownership and visibility; test cross-account access, media IDs, featured images, frames, ordering, deletion and short links. The existing single-owner model is not safe to assume multi-tenant.
- Review upload validation, file signatures, size/count quotas, malicious content, XSS, SQL injection, SSRF from external URLs, redirect abuse, CORS and content security policies.
- Audit waitlist consent, Turnstile validation, data retention, deletion, spam and access to email addresses.
- Review scoped storage permissions, encrypted credentials, revocation, OAuth state/PKCE, callback validation and provider isolation.
- Review Cloudflare WAF/rate limits, DDoS, hotlinking, cache isolation, resource exhaustion and cost ceilings; keep secrets out of build variables and logs.
- Test backup/restore of D1 and storage references, incident response, audit logging (no sensitive values), alerts and rollback.
- Run authorized non-destructive tests on staging, including unauthenticated and cross-account negative tests. Do not test third-party systems without authorization.
- Repeat automated dependency/secret scans on pull requests and periodically; document findings, severity, remediation and retest.
- Launch gate: resolve critical/high findings or explicitly document accepted residual risks; verify runtime configuration and privacy controls.

Status: backlog / not yet performed. No claim that FrameFeed is secure or vulnerability-free.
