import {env} from "cloudflare:workers";
export async function GET(req:Request,{params}:{params:Promise<{key:string}>}){
  const {key}=await params;
  if(!env.BUCKET)return new Response("Storage unavailable",{status:503});
  if(key.startsWith("thumb/"))return new Response("Not found",{status:404});
  const thumbnail=new URL(req.url).searchParams.get("thumb")==="1"&&/^[a-zA-Z0-9_-]{1,100}-[0-9]{1,2}$/.test(key);
  const small=thumbnail?await env.BUCKET.get("thumb/v1/"+key):null;
  const object=small||await env.BUCKET.get(key);
  if(!object)return new Response("Not found",{status:404});
  return new Response(object.body,{headers:{
    "Content-Type":small?"image/jpeg":object.httpMetadata?.contentType||"image/jpeg",
    "Cache-Control":thumbnail&&!small?"no-store":"public, max-age=3600, s-maxage=86400",
    "X-Content-Type-Options":"nosniff",
  }});
}
