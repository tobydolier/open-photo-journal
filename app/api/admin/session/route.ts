import {env} from "cloudflare:workers";
import {
  adminSessionCookie,clearAdminSessionCookie,createAdminSession,isAdminRequest,revokeAdminSession,
} from "../../../../lib/admin-auth";
import {hasPasswordLogin} from "../../../../lib/site-config";

const headers={"Cache-Control":"private, no-store"};
const error=(message:string,status:number,extra:Record<string,string>={})=>new Response(message,{status,headers:{...headers,...extra}});
const sameOrigin=(request:Request)=>request.headers.get("origin")===new URL(request.url).origin;

async function loginAttempt(request:Request){
  // Cloudflare supplies CF-Connecting-IP at the edge. Never trust X-Forwarded-For.
  if(!env.DB||!env.ADMIN_SESSION_SECRET)throw Error("Login unavailable");
  const ip=request.headers.get("CF-Connecting-IP")||"unknown";
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.ADMIN_SESSION_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode("login:"+ip));
  const id=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");
  const now=Date.now(),windowMs=15*60*1000;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_login_limits (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, until INTEGER NOT NULL)").run();
  // Single atomic increment; cap at six (five attempts, then block).
  const row=await env.DB.prepare(`INSERT INTO admin_login_limits(id,attempts,until) VALUES(?,1,?)
    ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN until<=? THEN 1 ELSE MIN(attempts+1,6) END,
      until=CASE WHEN until<=? THEN excluded.until ELSE until END RETURNING attempts,until`)
    .bind(id,now+windowMs,now,now).first<{attempts:number;until:number}>();
  if(!row)throw Error("Login unavailable");
  return {id,allowed:row.attempts<=5,retry:Math.max(1,Math.ceil((row.until-now)/1000))};
}

export async function GET(request:Request){
  return Response.json({isAdmin:await isAdminRequest(request.headers),passwordLoginEnabled:hasPasswordLogin()},{headers});
}

export async function POST(request:Request){
  if(!sameOrigin(request))return error("Forbidden",403);
  if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json")return error("Invalid request",415);
  if(!hasPasswordLogin())return error("Login unavailable",503);
  if(Number(request.headers.get("content-length")||0)>4096)return error("Request too large",413);
  let password:string;
  try{
    const reader=request.body?.getReader();
    if(!reader)return error("Invalid request",400);
    let size=0;const decoder=new TextDecoder();let raw="";
    try{
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return error("Request too large",413);}raw+=decoder.decode(value,{stream:true});}
      raw+=decoder.decode();
    }finally{reader.releaseLock();}
    const body=JSON.parse(raw);
    if(typeof body?.password!=="string"||!body.password||body.password.length>512)return error("Incorrect password",401);
    password=body.password;
  }catch{return error("Invalid request",400);}
  try{
    const attempt=await loginAttempt(request);
    if(!attempt.allowed)return error("Too many attempts. Try again later.",429,{"Retry-After":String(attempt.retry)});
    const token=await createAdminSession(password);
    if(!token)return error("Incorrect password",401);
    await env.DB!.prepare("DELETE FROM admin_login_limits WHERE id=? OR until<=?").bind(attempt.id,Date.now()).run();
    return Response.json({ok:true},{headers:{...headers,"Set-Cookie":adminSessionCookie(token)}});
  }catch{return error("Login temporarily unavailable",503);}
}

export async function DELETE(request:Request){
  if(!sameOrigin(request))return error("Forbidden",403);
  try{await revokeAdminSession(request.headers);}catch{return error("Could not revoke session. Try again.",503);}
  return Response.json({ok:true},{headers:{...headers,"Set-Cookie":clearAdminSessionCookie()}});
}
