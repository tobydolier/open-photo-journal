import { env } from "cloudflare:workers";

export async function GET() {
  const object = await env.BUCKET!.get("site/profile-image.webp");
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
}
