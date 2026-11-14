import { env } from "cloudflare:workers";

export type PostLocation = { name: string; latitude: number | null; longitude: number | null };

export async function ensurePostLocationsTable() {
  await env.DB!.prepare(`CREATE TABLE IF NOT EXISTS post_locations (
    post_id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    latitude REAL,
    longitude REAL
  )`).run();
}

function coordinate(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

export function normalisePostLocation(value: unknown): PostLocation | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const name = String(input.name ?? "").trim().slice(0, 160);
  const latitude = coordinate(input.latitude, -90, 90);
  const longitude = coordinate(input.longitude, -180, 180);
  if (!name && (latitude === null || longitude === null)) return null;
  return { name, latitude, longitude };
}

export async function savePostLocation(postId: string, location: PostLocation | null) {
  await ensurePostLocationsTable();
  if (!location) {
    await env.DB!.prepare("DELETE FROM post_locations WHERE post_id=?").bind(postId).run();
    return;
  }
  await env.DB!.prepare(`INSERT INTO post_locations(post_id,name,latitude,longitude) VALUES(?,?,?,?)
    ON CONFLICT(post_id) DO UPDATE SET name=excluded.name,latitude=excluded.latitude,longitude=excluded.longitude`)
    .bind(postId, location.name, location.latitude, location.longitude).run();
}
