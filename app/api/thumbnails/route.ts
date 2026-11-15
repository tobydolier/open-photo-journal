import {env} from "cloudflare:workers";
import {isAdminRequest} from "../../../lib/admin-auth";

const prefix="thumb/v1/";
const keyPattern=/^[a-zA-Z0-9_-]{1,100}-[0-9]{1,2}$/;

export async function GET(request:Request){
  if(!(await isAdminRequest(request.headers)))return new Response("Owner access required",{status:401});
  if(!env.BUCKET)return new Response("Storage unavailable",{status:503});
  const cursor=new URL(request.url).searchParams.get("cursor")||undefined;
  const result=await env.BUCKET.list({prefix,limit:500,cursor});
  return Response.json({keys:result.objects.map(o=>o.key.slice(prefix.length)),cursor:result.truncated?result.cursor:null},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  if(!(await isAdminRequest(request.headers)))return new Response("Owner access required",{status:401});
  if(request.headers.get("origin")!==new URL(request.url).origin)return new Response("Forbidden",{status:403});
  if(!env.DB||!env.BUCKET)return new Response("Storage unavailable",{status:503});
  const key=new URL(request.url).searchParams.get("key")||"";
  if(!keyPattern.test(key))return new Response("Invalid photo key",{status:400});
  const postId=key.slice(0,key.lastIndexOf("-"));
  const post=await env.DB.prepare("SELECT media FROM posts WHERE id=?").bind(postId).first<{media:string}>();
  if(!post||!(JSON.parse(post.media) as string[]).includes(key))return new Response("Photo not found",{status:404});
  if(await env.BUCKET.head(prefix+key))return Response.json({ok:true,existing:true});
  if(request.headers.get("content-type")!=="image/jpeg")return new Response("Expected JPEG",{status:415});
  const length=Number(request.headers.get("content-length")||0);
  if(length>160000)return new Response("Thumbnail too large",{status:413});
  if(!request.body)return new Response("Missing thumbnail",{status:400});
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];let size=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>160000){await reader.cancel();return new Response("Thumbnail too large",{status:413});}chunks.push(value);}
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  if(size<5||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes[size-2]!==255||bytes[size-1]!==217)return new Response("Invalid JPEG",{status:400});
  if(!await env.BUCKET.head(key))return new Response("Photo not found",{status:404});
  await env.BUCKET.put(prefix+key,bytes,{httpMetadata:{contentType:"image/jpeg"}});
  return Response.json({ok:true});
}
