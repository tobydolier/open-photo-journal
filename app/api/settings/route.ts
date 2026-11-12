import { env } from "cloudflare:workers";
import { isAdminRequest } from "../../../lib/admin-auth";
import {
  editableSettingLimits,
  saveSiteSettings,
  deleteSiteSetting,
  type EditableSettingKey,
} from "../../../lib/site-settings";

function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest(request.headers))) return new Response("Admin access required", { status: 401 });
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });

  const input = await request.json() as Record<string, unknown>;
  const values: Partial<Record<EditableSettingKey, string>> = {};
  for (const [key, limit] of Object.entries(editableSettingLimits) as [EditableSettingKey, number][]) {
    if (!(key in input)) continue;
    let value = String(input[key] ?? "").trim().slice(0, limit);
    if (key === "profileHandle") value = value.replace(/^@+/, "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (["siteName", "profileName", "profileHandle", "eyebrow", "visibilityLabel"].includes(key) && !value) {
      return new Response(`${key} cannot be empty`, { status: 400 });
    }
    values[key] = value;
  }
  if (values.profileName && !("profileInitial" in values)) {
    values.profileInitial = values.profileName.charAt(0).toUpperCase();
  }
  await saveSiteSettings(values);
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request.headers))) return new Response("Admin access required", { status: 401 });
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) return new Response("Choose a profile photo", { status: 400 });
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 4_000_000) {
    return new Response("Profile photo must be JPEG, PNG or WebP under 4 MB", { status: 400 });
  }
  await env.BUCKET!.put("site/profile-image.webp", await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  await saveSiteSettings({ profileImageVersion: String(Date.now()) });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest(request.headers))) return new Response("Admin access required", { status: 401 });
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });

  await env.BUCKET!.delete("site/profile-image.webp");
  await deleteSiteSetting("profileImageVersion");
  return Response.json({ ok: true });
}
