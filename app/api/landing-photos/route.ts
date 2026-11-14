import { env } from "cloudflare:workers";
import { isAdminRequest } from "../../../lib/admin-auth";

type Row={slot:number;post_id:string;media_key:string;caption:string;media:string};
const keyPattern=/^[a-zA-Z0-9_-]{1,120}$/;
const error=(message:string,status:number)=>Response.json({message},{status,headers:{"Cache-Control":"no-store"}});
const headers={"Cache-Control":"no-store"};

export async function GET() {
  const db=env.DB;
  if(!db)return Response.json({photos:Array(9).fill(null)},{headers});
  try {
    const {results}=await db.prepare(`SELECT f.slot,f.post_id,f.media_key,p.caption,p.media
      FROM featured_photos f JOIN posts p ON p.id=f.post_id ORDER BY f.slot`).all<Row>();
    const photos:(null|{slot:number;postId:string;key:string;src:string;caption:string})[]=Array(9).fill(null);
    for(const row of results){
      if(!Number.isInteger(row.slot)||row.slot<0||row.slot>8||!keyPattern.test(row.media_key))continue;
      try {
        const media=JSON.parse(row.media);
        if(!Array.isArray(media)||!media.includes(row.media_key))continue;
        photos[row.slot]={slot:row.slot,postId:row.post_id,key:row.media_key,
          src:"/api/media/"+encodeURIComponent(row.media_key),caption:row.caption||"Landscape photograph"};
      }catch{}
    }
    return Response.json({photos},{headers});
  } catch {
    // Migration not yet applied: landing stays on placeholders.
    return Response.json({photos:Array(9).fill(null)},{headers});
  }
}

export async function PUT(request:Request) {
  if(!(await isAdminRequest(request.headers)))return error("Owner access required",401);
  if(request.headers.get("origin")!==new URL(request.url).origin)return error("Forbidden",403);
  if(request.headers.get("content-type")?.split(";")[0]?.trim()!=="application/json")return error("Invalid content type",415);
  let body:unknown;
  try {body=await request.json();}catch{return error("Invalid request",400);}
  if(!body||typeof body!=="object")return error("Invalid selection",400);
  const {slot,postId,mediaKey} = body as {slot:unknown;postId:unknown;mediaKey:unknown};
  if(!Number.isInteger(slot)||(slot as number)<0||(slot as number)>8)return error("Invalid gallery position",400);
  if(typeof postId!=="string"||!keyPattern.test(postId))return error("Invalid post",400);
  if(typeof mediaKey!=="string"||!keyPattern.test(mediaKey))return error("Invalid photo",400);
  const db=env.DB;
  if(!db)return error("Database unavailable",503);
  try{
    const row=await db.prepare("SELECT media FROM posts WHERE id=?").bind(postId).first<{media:string}>();
    if(!row)return error("Photo not in your feed",404);
    const media=JSON.parse(row.media) as unknown;
    if(!Array.isArray(media)||!media.includes(mediaKey))return error("Photo not in that post",400);
    await db.prepare(`INSERT INTO featured_photos(slot,post_id,media_key) VALUES(?,?,?)
      ON CONFLICT(slot) DO UPDATE SET post_id=excluded.post_id, media_key=excluded.media_key`)
      .bind(slot,postId,mediaKey).run();
    return Response.json({ok:true},{headers});
  }catch{return error("Couldn't save the gallery selection. Check the featured-photos migration.",503);}
}

export async function PATCH(request:Request) {
  if(!(await isAdminRequest(request.headers)))return error("Owner access required",401);
  if(request.headers.get("origin")!==new URL(request.url).origin)return error("Forbidden",403);
  if(request.headers.get("content-type")?.split(";")[0]?.trim()!=="application/json")return error("Invalid content type",415);
  let body:unknown;
  try {body=await request.json();}catch{return error("Invalid request",400);}
  const items=(body as {items?:unknown})?.items;
  if(!Array.isArray(items)||items.length>9)return error("Invalid gallery order",400);
  const parsed:{postId:string;mediaKey:string}[]=[];
  const seen=new Set<string>();
  for(const item of items){
    if(!item||typeof item!=="object")return error("Invalid gallery photograph",400);
    const {postId,mediaKey}=item as {postId:unknown;mediaKey:unknown};
    if(typeof postId!=="string"||!keyPattern.test(postId)||typeof mediaKey!=="string"||!keyPattern.test(mediaKey))return error("Invalid gallery photograph",400);
    const identity=`${postId}:${mediaKey}`;
    if(seen.has(identity))return error("A photograph can only appear once",400);
    seen.add(identity);
    parsed.push({postId,mediaKey});
  }
  const db=env.DB;
  if(!db)return error("Database unavailable",503);
  try{
    for(const item of parsed){
      const row=await db.prepare("SELECT media FROM posts WHERE id=?").bind(item.postId).first<{media:string}>();
      if(!row)return error("Photo not in your feed",404);
      const media=JSON.parse(row.media) as unknown;
      if(!Array.isArray(media)||!media.includes(item.mediaKey))return error("Photo not in that post",400);
    }
    await db.batch([
      db.prepare("DELETE FROM featured_photos"),
      ...parsed.map((item,slot)=>db.prepare("INSERT INTO featured_photos(slot,post_id,media_key) VALUES(?,?,?)").bind(slot,item.postId,item.mediaKey)),
    ]);
    return Response.json({ok:true},{headers});
  }catch{return error("Couldn't save the gallery order",503);}
}

export async function DELETE(request:Request) {
  if(!(await isAdminRequest(request.headers)))return error("Owner access required",401);
  if(request.headers.get("origin")!==new URL(request.url).origin)return error("Forbidden",403);
  const url=new URL(request.url);
  const slot=Number(url.searchParams.get("slot"));
  if(!Number.isInteger(slot)||slot<0||slot>8)return error("Invalid gallery position",400);
  try{
    await env.DB!.prepare("DELETE FROM featured_photos WHERE slot=?").bind(slot).run();
    return Response.json({ok:true},{headers});
  }catch{return error("Couldn't remove gallery photo",503);}
}
