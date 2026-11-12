import { env } from "cloudflare:workers";
import { isAdminRequest } from "../../../lib/admin-auth";

type FrameStyle = "white" | "mahogany" | "black";
type Row = { post_id: string; media_key: string; style: string; media: string };
const keyPattern = /^[a-zA-Z0-9_-]{1,120}$/;
const allowedStyles = new Set<FrameStyle>(["white", "mahogany", "black"]);
const headers = { "Cache-Control": "private, no-store" };
const error = (message: string, status: number) => Response.json({ message }, { status, headers });

export async function GET() {
  try {
    const { results } = await env.DB!.prepare(`SELECT f.post_id,f.media_key,f.style,p.media
      FROM photo_frames f JOIN posts p ON p.id=f.post_id`).all<Row>();
    const frames = results.flatMap(row => {
      if (!allowedStyles.has(row.style as FrameStyle) || !keyPattern.test(row.media_key)) return [];
      try {
        const media = JSON.parse(row.media) as unknown;
        if (!Array.isArray(media) || !media.includes(row.media_key)) return [];
        return [{ postId: row.post_id, key: row.media_key, style: row.style as FrameStyle }];
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
  const { postId, mediaKey, style } = body as { postId: unknown; mediaKey: unknown; style: unknown };
  if (typeof postId !== "string" || !keyPattern.test(postId)) return error("Invalid post", 400);
  if (typeof mediaKey !== "string" || !keyPattern.test(mediaKey)) return error("Invalid photo", 400);
  if (style !== "" && (typeof style !== "string" || !allowedStyles.has(style as FrameStyle))) return error("Invalid frame style", 400);
  try {
    const row = await env.DB!.prepare("SELECT media FROM posts WHERE id=?").bind(postId).first<{ media: string }>();
    if (!row) return error("Photo not in your journal", 404);
    const media = JSON.parse(row.media) as unknown;
    if (!Array.isArray(media) || !media.includes(mediaKey)) return error("Photo not in that post", 400);
    const id = `${postId}:${mediaKey}`;
    if (style === "") {
      await env.DB!.prepare("DELETE FROM photo_frames WHERE id=?").bind(id).run();
    } else {
      await env.DB!.prepare(`INSERT INTO photo_frames(id,post_id,media_key,style) VALUES(?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET style=excluded.style`)
        .bind(id, postId, mediaKey, style).run();
    }
    return Response.json({ ok: true, frame: style === "" ? null : { postId, key: mediaKey, style } }, { headers });
  } catch {
    return error("Could not save the frame", 503);
  }
}
