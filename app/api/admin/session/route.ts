import {
  adminSessionCookie,
  clearAdminSessionCookie,
  createAdminSession,
  isAdminRequest,
} from "../../../../lib/admin-auth";
import { hasPasswordLogin } from "../../../../lib/site-config";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function GET(request: Request) {
  return Response.json({
    isAdmin: await isAdminRequest(request.headers),
    passwordLoginEnabled: hasPasswordLogin(),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const body = await request.json().catch(() => ({})) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password.slice(0, 512) : "";
  const token = await createAdminSession(password);
  if (!token) return new Response("Incorrect password", { status: 401 });
  return Response.json({ ok: true }, { headers: { "Set-Cookie": adminSessionCookie(token) } });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearAdminSessionCookie() } });
}
