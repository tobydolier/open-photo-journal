import { isAdminRequest } from "../../../lib/admin-auth";
import { getPublicSiteConfig, hasPasswordLogin } from "../../../lib/site-config";

export async function GET(request: Request) {
  return Response.json({
    ...getPublicSiteConfig(),
    isAdmin: await isAdminRequest(request.headers),
    passwordLoginEnabled: hasPasswordLogin(),
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
