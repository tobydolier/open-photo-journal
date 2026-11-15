import {env} from "cloudflare:workers";
import {isAdminRequest} from "../../../lib/admin-auth";

export async function GET(request:Request){
  if(!(await isAdminRequest(request.headers)))return new Response("Owner access required",{status:401});
  if(!env.BUCKET)return new Response("Storage unavailable",{status:503});
  const cursor=new URL(request.url).searchParams.get("cursor")||undefined;
  const result=await env.BUCKET.list({limit:500,cursor});
  let photos=0,thumbnails=0,other=0;
  for(const object of result.objects){
    if(object.key.startsWith("thumb/v1/"))thumbnails+=object.size;
    else if(/^[a-zA-Z0-9_-]{1,100}-[0-9]{1,2}$/.test(object.key))photos+=object.size;
    else other+=object.size;
  }
  return Response.json({photos,thumbnails,other,cursor:result.truncated?result.cursor:null},{headers:{"Cache-Control":"private, no-store"}});
}
