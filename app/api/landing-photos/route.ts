import {env} from "cloudflare:workers";
// Curated by the platform owner. Never automatically display arbitrary users' photos.
export async function GET() {
  const keys = (env.LANDING_FEATURED_MEDIA_KEYS || "").split(",").map(k=>k.trim()).filter(k=>/^[A-Za-z0-9_-]{1,120}$/.test(k)).slice(0,3);
  return Response.json({photos:keys.map(key=>"/api/media/"+encodeURIComponent(key))},{headers:{"Cache-Control":"public, max-age=300"}});
}
