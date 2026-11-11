import {env} from "cloudflare:workers";
import {isAdminRequest} from "../../../../lib/admin-auth";

// The owner chooses the display order. Never modify historical post dates.
export async function PUT(request:Request) {
  if(!(await isAdminRequest(request.headers)))return new Response("Owner access required",{status:401});
  if(request.headers.get("origin") !== new URL(request.url).origin)return new Response("Forbidden",{status:403});
  if(request.headers.get("content-type")?.split(";")[0] !== "application/json")return new Response("Unsupported content type",{status:415});
  let body:unknown;
  try{body=await request.json();}catch{return new Response("Invalid JSON",{status:400});}
  const ids=(body as {ids?:unknown})?.ids;
  if(!Array.isArray(ids)||ids.length>10000||ids.some(x=>typeof x!=="string"||!/^[a-zA-Z0-9_-]{1,100}$/.test(x))||new Set(ids).size!==ids.length)
    return new Response("Invalid post order",{status:400});
  const db=env.DB;
  if(!db)return new Response("Database unavailable",{status:503});
  try{
    const count=await db.prepare("SELECT COUNT(*) AS n FROM posts").first<{n:number}>();
    if(count?.n!==ids.length)return new Response("The gallery changed. Refresh before reordering.",{status:409});
    const statements=ids.map((id,index)=>db.prepare("UPDATE posts SET sort_order = ? WHERE id = ?").bind(index,id));
    const results=await db.batch(statements);
    if(results.some(r=>r.meta?.changes!==1))return new Response("The gallery changed. Refresh before reordering.",{status:409});
    return Response.json({ok:true});
  }catch(e){return new Response("Couldn't save the order. Check the database migration.",{status:503});}
}
