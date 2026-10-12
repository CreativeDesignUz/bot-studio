import { getSupabaseServer } from "@/lib/supabase/server";
export async function POST(request:Request){
  let token="";
  try{const raw=await request.text();if(raw.length>10000)return Response.json({error:"Invalid request"},{status:413});token=(JSON.parse(raw) as {token?:string}).token??"";}catch{return Response.json({error:"Invalid request"},{status:400});}
  if(typeof token!=="string"||token.length<20||token.length>8192)return Response.json({error:"Invalid token"},{status:400});
  const client=getSupabaseServer();
  const {data,error}=await client.auth.getUser(token);
  if(error||!data.user||data.user.app_metadata?.provider!=="google")return Response.json({error:"Invalid Google session"},{status:401});
  return Response.json({ok:true},{headers:{"cache-control":"no-store","set-cookie":`bot_studio_access_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`}});
}
