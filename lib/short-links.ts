const shortCodePattern = /^[23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ]{4,12}$/;
const alphabet = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

export async function ensureShortLinksTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS post_short_links (
    code TEXT PRIMARY KEY NOT NULL,
    post_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_post_short_links_post ON post_short_links(post_id)").run();
}

function createShortCode(length = 4) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
}

export async function getOrCreateShortCode(db: D1Database, postId: string) {
  await ensureShortLinksTable(db);
  const existing = await db.prepare("SELECT code FROM post_short_links WHERE post_id=?")
    .bind(postId).first<{code:string}>();
  if (existing?.code) return existing.code;

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = createShortCode();
    try {
      await db.prepare("INSERT INTO post_short_links(code,post_id,created_at) VALUES(?,?,?)")
        .bind(code, postId, new Date().toISOString()).run();
      return code;
    } catch {
      const concurrentlyCreated = await db.prepare("SELECT code FROM post_short_links WHERE post_id=?")
        .bind(postId).first<{code:string}>();
      if (concurrentlyCreated?.code) return concurrentlyCreated.code;
    }
  }
  throw new Error("Could not create a unique short link");
}

export async function resolveShortCode(db: D1Database, code: string) {
  if (!shortCodePattern.test(code)) return null;
  await ensureShortLinksTable(db);
  const row = await db.prepare(`SELECT s.post_id FROM post_short_links s
    INNER JOIN posts p ON p.id=s.post_id WHERE s.code=?`).bind(code).first<{post_id:string}>();
  return row?.post_id || null;
}
