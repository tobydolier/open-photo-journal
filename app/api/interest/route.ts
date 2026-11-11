import { env } from "cloudflare:workers";

const json = (message:string,status:number) => Response.json({message},{status,headers:{"Cache-Control":"no-store"}});
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function POST(request:Request){
  const origin = new URL(request.url).origin;
  if(request.headers.get("origin") !== origin) return json("Invalid request origin.",403);
  if(request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") return json("Invalid request.",415);
  if(Number(request.headers.get("content-length")||0)>3000) return json("Request too large.",413);
  let body:Record<string,unknown>;
  try { body = await request.json() as Record<string,unknown>; } catch { return json("Invalid request.",400); }
  if(body.website) return Response.json({message:"Thank you — we've noted your interest."});
  if(body.consent !== true) return json("Please confirm you want launch updates.",400);
  const email = String(body.email||"").trim().toLowerCase();
  if(email.length>254 || !emailPattern.test(email)) return json("Enter a valid email address.",400);

  // Fail closed until database migration and Cloudflare Turnstile are enabled.
  if(env.WAITLIST_ENABLED !== "1" || !env.TURNSTILE_SECRET_KEY)
    return json("Early registration is not open just yet. Please check back soon.",503);
  const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if(!token || token.length>2048) return json("Please complete the security check.",400);
  try {
    const form = new FormData();
    form.set("secret",env.TURNSTILE_SECRET_KEY);
    form.set("response",token);
    const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:form});
    if(!verify.ok) return json("Security verification unavailable. Please try again.",503);
    const result = await verify.json() as {success?:boolean,hostname?:string};
    const allowedHosts = ["framefeed.co.uk","www.framefeed.co.uk","framefeed.cnp85h7bzn.workers.dev"];
    if(!result.success || !result.hostname || !allowedHosts.includes(result.hostname))
      return json("Security check unsuccessful. Please try again.",403);
    await env.DB!.prepare("INSERT INTO interest_signups (id,email,consented_at,created_at) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING")
      .bind(crypto.randomUUID(),email,new Date().toISOString(),new Date().toISOString()).run();
    return Response.json({message:"Thank you — we've noted your interest."},{headers:{"Cache-Control":"no-store"}});
  }catch{
    return json("Couldn't register your interest right now. Please try again later.",503);
  }
}
