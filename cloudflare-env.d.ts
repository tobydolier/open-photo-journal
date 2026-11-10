declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SITE_NAME?: string;
    SITE_DESCRIPTION?: string;
    SITE_EYEBROW?: string;
    SITE_LOCALE?: string;
    PROFILE_NAME?: string;
    PROFILE_HANDLE?: string;
    PROFILE_BIO?: string;
    PROFILE_INITIAL?: string;
    VISIBILITY_LABEL?: string;
    STORAGE_LIMIT_BYTES?: string;
    PUBLIC_SITE_URL?: string;
    ADMIN_EMAIL?: string;
    ADMIN_PASSWORD?: string;
    ADMIN_SESSION_SECRET?: string;
  }
}
