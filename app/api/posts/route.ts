import { env } from "cloudflare:workers";
import { isAdminRequest } from "../../../lib/admin-auth";
import { ensurePostLocationsTable, normalisePostLocation, savePostLocation } from "../../../lib/post-locations";

const idPattern=/^[a-zA-Z0-9_-]{1,100}$/;
const supportedImageTypes=new Set(["image/jpeg","image/webp","image/png"]);

async function detectedImageType(file:File){
  const declared=file.type.toLowerCase();
  if(supportedImageTypes.has(declared))return declared;
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return "image/jpeg";
  if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)return "image/png";
  if(String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")return "image/webp";
  return "";
}

export async function GET(){
  await ensurePostLocationsTable();
  let result;
  const select=`SELECT p.*,l.name AS location_name,l.latitude,l.longitude
    FROM posts p LEFT JOIN post_locations l ON l.post_id=p.id`;
  try{
    result=await env.DB!.prepare(`${select} ORDER BY CASE WHEN p.sort_order IS NULL THEN 1 ELSE 0 END, p.sort_order ASC, p.date DESC, p.id DESC`).all();
  }catch{
    result=await env.DB!.prepare(`${select} ORDER BY p.date DESC,p.id DESC`).all();
  }
  return Response.json(result.results.map((post:any)=>({
    ...post,
    media:JSON.parse(post.media),
    location:post.location_name||post.latitude!==null&&post.longitude!==null
      ? {name:post.location_name||"",latitude:post.latitude??null,longitude:post.longitude??null}
      : null,
    location_name:undefined,latitude:undefined,longitude:undefined,
  })));
}

export async function POST(request:Request){
  if(!(await isAdminRequest(request.headers)))return new Response("Admin access required",{status:401});
  if(request.headers.get("origin")!==new URL(request.url).origin)return new Response("Forbidden",{status:403});
  const form=await request.formData();
  const id=String(form.get("id"));
  if(!idPattern.test(id))return new Response("Invalid ID",{status:400});
  await ensurePostLocationsTable();
  const locationProvided=form.get("locationProvided")==="1";
  const location=normalisePostLocation({name:form.get("locationName"),latitude:form.get("latitude"),longitude:form.get("longitude")});
  if(await env.DB!.prepare("SELECT id FROM posts WHERE id=?").bind(id).first()){
    if(locationProvided)await savePostLocation(id,location);
    return Response.json({duplicate:true,locationUpdated:locationProvided});
  }
  const files=form.getAll("photos") as File[];
  if(!files.length||files.length>20)return new Response("Choose 1–20 photos",{status:400});
  let size=0;
  const mediaTypes:string[]=[];
  for(let index=0;index<files.length;index++){
    const file=files[index];
    const mediaType=await detectedImageType(file);
    if(!mediaType)return new Response(`Photo ${index+1} was received as ${file.type||"an unknown format"}. Please choose a JPEG, PNG or WebP image.`,{status:400});
    if(file.size>4e6)return new Response(`Photo ${index+1} is ${(file.size/1e6).toFixed(1)} MB after processing; the limit is 4 MB.`,{status:400});
    mediaTypes.push(mediaType);
    size+=file.size;
  }
  const used=await env.DB!.prepare("SELECT COALESCE(SUM(bytes),0) AS n FROM posts").first<{n:number}>();
  const limit=Number(env.STORAGE_LIMIT_BYTES)||8e9;
  if((used?.n||0)+size>limit)return new Response("Storage safety limit reached",{status:400});
  const keys:string[]=[];
  try{
    for(let index=0;index<files.length;index++){
      const key=`${id}-${index}`;
      await env.BUCKET!.put(key,await files[index].arrayBuffer(),{httpMetadata:{contentType:mediaTypes[index]}});
      keys.push(key);
    }
    const statements=[env.DB!.prepare("INSERT INTO posts(id,caption,date,source,media,bytes) VALUES(?,?,?,?,?,?)")
      .bind(id,String(form.get("caption")||"").slice(0,20000),String(form.get("date")||new Date().toISOString()),form.get("source")==="instagram"?"instagram":"native",JSON.stringify(keys),size)];
    if(locationProvided&&location)statements.push(env.DB!.prepare("INSERT INTO post_locations(post_id,name,latitude,longitude) VALUES(?,?,?,?)")
      .bind(id,location.name,location.latitude,location.longitude));
    await env.DB!.batch(statements);
    return Response.json({ok:true});
  }catch{
    await Promise.all(keys.map(key=>env.BUCKET!.delete(key)));
    return new Response("Could not save post. Please retry.",{status:500});
  }
}

export async function PATCH(request:Request){
  if(!(await isAdminRequest(request.headers)))return new Response("Admin access required",{status:401});
  if(request.headers.get("origin")!==new URL(request.url).origin)return new Response("Forbidden",{status:403});
  const input=await request.json() as {id?:unknown;favorite?:unknown;location?:unknown};
  if(typeof input.id!=="string"||!idPattern.test(input.id))return new Response("Invalid ID",{status:400});
  if(Object.prototype.hasOwnProperty.call(input,"location"))await savePostLocation(input.id,normalisePostLocation(input.location));
  else if(typeof input.favorite==="boolean")await env.DB!.prepare("UPDATE posts SET favorite=? WHERE id=?").bind(input.favorite?1:0,input.id).run();
  else return new Response("Invalid update",{status:400});
  return Response.json({ok:true});
}

export async function DELETE(request:Request){
  if(!(await isAdminRequest(request.headers)))return new Response("Admin access required",{status:401});
  if(request.headers.get("origin")!==new URL(request.url).origin)return new Response("Forbidden",{status:403});
  const {id}=await request.json() as {id:string};
  if(!idPattern.test(id))return new Response("Invalid ID",{status:400});
  const post=await env.DB!.prepare("SELECT media FROM posts WHERE id=?").bind(id).first<{media:string}>();
  if(post){
    const keys=JSON.parse(post.media) as string[];
    await Promise.all(keys.map(key=>env.BUCKET!.delete(key)));
    try{await env.DB!.prepare("DELETE FROM featured_photos WHERE post_id=?").bind(id).run();}catch{}
    try{await env.DB!.prepare("DELETE FROM photo_frames WHERE post_id=?").bind(id).run();}catch{}
    try{await env.DB!.prepare("DELETE FROM post_locations WHERE post_id=?").bind(id).run();}catch{}
    await env.DB!.prepare("DELETE FROM posts WHERE id=?").bind(id).run();
  }
  return Response.json({ok:true});
}
