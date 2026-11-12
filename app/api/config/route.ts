import { isAdminRequest } from "../../../lib/admin-auth";
import { getPublicSiteConfig, hasPasswordLogin } from "../../../lib/site-config";
import { editableSettingLimits, getSiteSettings } from "../../../lib/site-settings";

export async function GET(request: Request) {
  const base = getPublicSiteConfig();
  const stored = await getSiteSettings();
  const overrides: Record<string, string> = {};
  for (const key of Object.keys(editableSettingLimits)) {
    if (stored[key] !== undefined) overrides[key] = stored[key];
  }
  const profileImageUrl = stored.profileImageVersion
    ? `/api/settings/profile-image?v=${encodeURIComponent(stored.profileImageVersion)}`
    : base.profileImageUrl;

  return Response.json({
    ...base,
    ...overrides,
    profileImageUrl,
    isAdmin: await isAdminRequest(request.headers),
    passwordLoginEnabled: hasPasswordLogin(),
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
