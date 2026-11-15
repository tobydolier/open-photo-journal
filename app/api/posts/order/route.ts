import {env} from "cloudflare:workers";
import {isAdminRequest} from "../../../../lib/admin-auth";

// Single-owner journal: validate the entire sequence before updating it.
export async function PUT(request:Request) {
  if(!(await isAdminRequest(request.headers)))return new Response("Owner access required",{status:401});
  if(request.headers.get("origin") !== new URL(request.url).origin)return new Response("Forbidden",{status:403});
  if(request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")return new Response("Unsupported content type",{status:415});
  let body:unknown;
  try{
    const raw=await request.text();
    if(raw.length>2100000)return new Response("Order too large",{status:413});
    body=JSON.parse(raw);
  }catch{return new Response("Invalid JSON",{status:400});}
  const {ids,previousIds}=(body||{}) as {ids?:unknown;previousIds?:unknown};
  const valid=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=10000&&v.every(x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(x))&&new Set(v).size===v.length;
  const sameMembers=(a:string[],b:string[])=>{const members=new Set(b);return a.every(id=>members.has(id));};
  if(!valid(ids)||!valid(previousIds)||ids.length!==previousIds.length||!sameMembers(ids,previousIds))
    return new Response("Invalid post order",{status:400});
  const db=env.DB;
  if(!db)return new Response("Database unavailable",{status:503});
  try{
    // One atomic SQLite update; JSON arrays avoid D1's per-query parameter cap
    // and the former thousands-of-statements batch. Compare-and-set rejects
    // simultaneous edits, additions or removals instead of overwriting them.
    const current=await db.prepare(`SELECT id FROM posts
      ORDER BY CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END,sort_order,date DESC,id DESC`).all<{id:string}>();
    const currentIds=current.results.map(row=>row.id);
    if(JSON.stringify(currentIds)!==JSON.stringify(previousIds))
      return new Response("The gallery changed. Refresh before reordering.",{status:409});
    if(!ids.length)return Response.json({ok:true});
    const prior=JSON.stringify(previousIds);
    const result=await db.prepare(`WITH proposed AS (
      SELECT value AS id,CAST(key AS INTEGER) AS position FROM json_each(?1)
    ), current_sequence AS MATERIALIZED (
      SELECT json_group_array(id) AS ids FROM (
        SELECT id FROM posts ORDER BY CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END,sort_order,date DESC,id DESC
      )
    )
    UPDATE posts SET sort_order=(SELECT position FROM proposed WHERE proposed.id=posts.id)
    WHERE (SELECT ids FROM current_sequence)=?2
      AND id IN (SELECT id FROM proposed)`).bind(JSON.stringify(ids),prior).run();
    if(result.meta.changes!==ids.length)return new Response("The gallery changed. Refresh before reordering.",{status:409});
    return Response.json({ok:true});
  }catch{return new Response("Couldn't save the order. Check the database migration.",{status:503});}
}
