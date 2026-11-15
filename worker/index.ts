import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { resolveShortCode } from "../lib/short-links";

function safeJournalOrigin(value?: string) {
  try {
    const url = new URL(value || "https://toby.framefeed.co.uk");
    return url.protocol === "https:" ? url.origin : "https://toby.framefeed.co.uk";
  } catch {
    return "https://toby.framefeed.co.uk";
  }
}

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    // Keep Workers development URL on the original photo journal. The apex
    // domain becomes the platform landing; personal subdomains stay journals.
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    if (host === "frfd.uk" || host === "www.frfd.uk") {
      if (url.pathname === "/") return Response.redirect("https://framefeed.co.uk/", 302);
      const code = decodeURIComponent(url.pathname.slice(1));
      if (!code.includes("/") && env.DB) {
        const postId = await resolveShortCode(env.DB, code);
        if (postId) {
          const destination = `${safeJournalOrigin(env.PUBLIC_SITE_URL)}/p/${encodeURIComponent(postId)}`;
          return Response.redirect(destination, 302);
        }
      }
      return new Response("This FrameFeed short link could not be found.", {
        status: 404,
        headers: {"content-type": "text/plain; charset=utf-8", "cache-control": "no-store"},
      });
    }
    if ((host === "framefeed.co.uk" || host === "www.framefeed.co.uk") && url.pathname.startsWith("/p/")) {
      return Response.redirect(`${safeJournalOrigin(env.PUBLIC_SITE_URL)}${url.pathname}${url.search}`, 308);
    }
    if ((host === "framefeed.co.uk" || host === "www.framefeed.co.uk") && url.pathname === "/") {
      url.pathname = "/welcome";
      request = new Request(url.toString(), request);
    }
    const response=await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    const headers=new Headers(response.headers);
    headers.set("X-Content-Type-Options","nosniff");
    headers.set("X-Frame-Options","DENY");
    headers.set("Referrer-Policy","strict-origin-when-cross-origin");
    headers.set("Permissions-Policy","camera=(), microphone=(), payment=(), geolocation=(self)");
    if(url.protocol==="https:")headers.set("Strict-Transport-Security","max-age=31536000");
    // Start with a conservative CSP; do not block framework-generated scripts or Turnstile.
    if(!headers.has("Content-Security-Policy"))headers.set("Content-Security-Policy","object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  },
};

export default worker;
