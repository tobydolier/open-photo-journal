# Security

## Supported version

Security fixes currently target the latest commit on `main`.

## Reporting a vulnerability

Please do not open a public issue containing exploit details, credentials, or
private photographs. Contact the repository owner privately through GitHub.

## Deployment notes

- Never commit `.env`, `.dev.vars`, passwords, session secrets, account IDs, or
  exported photo archives.
- Keep the site read-only until `ADMIN_EMAIL` or both `ADMIN_PASSWORD` and
  `ADMIN_SESSION_SECRET` are configured.
- Use HTTPS in production. The administrator session cookie is `Secure`,
  `HttpOnly`, and `SameSite=Strict`.
- Restrict the R2 bucket itself; photographs are served through the application
  route so bucket credentials and object-management operations stay server-side.
- Back up the D1 database and R2 objects before schema changes or bulk imports.
