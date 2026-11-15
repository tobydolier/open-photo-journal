import {env} from "cloudflare:workers";
const allowedTypes=new Set(["image/jpeg","image/png","image/webp"]);
export async function GET(req:Request,{params}:{params:Promise<{key:string}>}){
  const {key}=await params;
  if(!env.BUCKET||!env.DB)return new Response("Storage unavailable",{status:503});
  if(!/^[a-zA-Z0-9_-]{1,100}-[0-9]{1,2}$/.test(key))return new Response("Not found",{status:404});
  const id=key.slice(0,key.lastIndexOf("-"));
  const post=await env.DB.prepare("SELECT media FROM posts WHERE id=?").bind(id).first<{media:string}>();
  if(!post||!(JSON.parse(post.media) as string[]).includes(key))return new Response("Not found",{status:404,headers:{"Cache-Control":"no-store"}});
  const thumbnail=new URL(req.url).searchParams.get("thumb")==="1";
  const small=thumbnail?await env.BUCKET.get("thumb/v1/"+key):null;
  const object=small||await env.BUCKET.get(key);
  if(!object)return new Response("Not found",{status:404});
  const type=small?"image/jpeg":object.httpMetadata?.contentType||"";
  if(!allowedTypes.has(type))return new Response("Unsupported media",{status:415});
  return new Response(object.body,{headers:{
    "Content-Type":type,
    "Cache-Control":thumbnail&&!small?"no-store":"public, max-age=300, s-maxage=300",
    "X-Content-Type-Options":"nosniff",
    "Cross-Origin-Resource-Policy":"same-site",
  }});
}
