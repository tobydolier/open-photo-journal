import { env } from "cloudflare:workers";
import { isAdminRequest } from "../../../lib/admin-auth";
import { ensureSiteSettingsTable } from "../../../lib/site-settings";

type FrameStyle = "white" | "mahogany" | "ornate" | "black" | "pine";
type Row = { post_id: string; media_key: string; style: string; media: string; mount_colour: string | null };
const keyPattern = /^[a-zA-Z0-9_-]{1,120}$/;
const allowedStyles = new Set<FrameStyle>(["white", "mahogany", "ornate", "black", "pine"]);
const colourPattern = /^hsl\((?:[0-9]{1,2}|[12][0-9]{2}|3[0-5][0-9]|360) (?:[0-9]|[1-9][0-9]|100)% (?:[0-9]|[1-9][0-9]|100)%\)$/;
const headers = { "Cache-Control": "private, no-store" };
const error = (message: string, status: number) => Response.json({ message }, { status, headers });

async function ensureOrnateFrameStyle() {
  const table = await env.DB!.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='photo_frames'"
  ).first<{ sql: string }>();
  if (table?.sql?.includes("'ornate'")) return;

  await env.DB!.batch([
    env.DB!.prepare(`CREATE TABLE IF NOT EXISTS photo_frames_with_ornate (
      id TEXT PRIMARY KEY NOT NULL,
      post_id TEXT NOT NULL,
      media_key TEXT NOT NULL,
      style TEXT NOT NULL CHECK (style IN ('white','mahogany','ornate','black','pine'))
    )`),
    env.DB!.prepare("DELETE FROM photo_frames_with_ornate"),
    env.DB!.prepare(`INSERT INTO photo_frames_with_ornate (id,post_id,media_key,style)
      SELECT id,post_id,media_key,style FROM photo_frames`),
    env.DB!.prepare("DROP TABLE photo_frames"),
    env.DB!.prepare("ALTER TABLE photo_frames_with_ornate RENAME TO photo_frames"),
    env.DB!.prepare("CREATE INDEX idx_photo_frames_post ON photo_frames(post_id)"),
  ]);
}

export async function GET() {
  try {
    await ensureSiteSettingsTable();
    const { results } = await env.DB!.prepare(`SELECT f.post_id,f.media_key,f.style,p.media,s.value AS mount_colour
      FROM photo_frames f JOIN posts p ON p.id=f.post_id
      LEFT JOIN site_settings s ON s.key='mount:'||f.id`).all<Row>();
    const frames = results.flatMap(row => {
      if (!allowedStyles.has(row.style as FrameStyle) || !keyPattern.test(row.media_key)) return [];
      try {
        const media = JSON.parse(row.media) as unknown;
        if (!Array.isArray(media) || !media.includes(row.media_key)) return [];
        return [{ postId: row.post_id, key: row.media_key, style: row.style as FrameStyle,
          mountColour: row.mount_colour && colourPattern.test(row.mount_colour) ? row.mount_colour : "" }];
      } catch { return []; }
    });
    return Response.json({ frames, databaseReady: true }, { headers });
  } catch {
    return Response.json({ frames: [], databaseReady: false }, { headers });
  }
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest(request.headers))) return error("Owner access required", 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return error("Forbidden", 403);
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") return error("Invalid content type", 415);
  let body: unknown;
  try { body = await request.json(); } catch { return error("Invalid request", 400); }
  if (!body || typeof body !== "object") return error("Invalid frame selection", 400);
  const { postId, mediaKey, style, mountColour } = body as { postId: unknown; mediaKey: unknown; style: unknown; mountColour?: unknown };
  if (typeof postId !== "string" || !keyPattern.test(postId)) return error("Invalid post", 400);
  if (typeof mediaKey !== "string" || !keyPattern.test(mediaKey)) return error("Invalid photo", 400);
  if (style !== "" && (typeof style !== "string" || !allowedStyles.has(style as FrameStyle))) return error("Invalid frame style", 400);
  if (mountColour !== undefined && (typeof mountColour !== "string" || (mountColour !== "" && !colourPattern.test(mountColour)))) return error("Invalid mount colour", 400);
  try {
    if (style === "ornate") await ensureOrnateFrameStyle();
    const row = await env.DB!.prepare("SELECT media FROM posts WHERE id=?").bind(postId).first<{ media: string }>();
    if (!row) return error("Photo not in your journal", 404);
    const media = JSON.parse(row.media) as unknown;
    if (!Array.isArray(media) || !media.includes(mediaKey)) return error("Photo not in that post", 400);
    const id = `${postId}:${mediaKey}`;
    await ensureSiteSettingsTable();
    if (style === "") {
      await env.DB!.batch([
        env.DB!.prepare("DELETE FROM photo_frames WHERE id=?").bind(id),
        env.DB!.prepare("DELETE FROM site_settings WHERE key=?").bind(`mount:${id}`),
      ]);
    } else {
      const statements=[env.DB!.prepare(`INSERT INTO photo_frames(id,post_id,media_key,style) VALUES(?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET style=excluded.style`).bind(id, postId, mediaKey, style)];
      if(typeof mountColour==="string"&&mountColour)statements.push(env.DB!.prepare(`INSERT INTO site_settings(key,value) VALUES(?,?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(`mount:${id}`,mountColour));
      await env.DB!.batch(statements);
    }
    return Response.json({ ok: true, frame: style === "" ? null : { postId, key: mediaKey, style, mountColour: typeof mountColour==="string"?mountColour:"" } }, { headers });
  } catch {
    return error("Could not save the frame", 503);
  }
}
