import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

type Login={id?:number;auth_date?:number;hash?:string;first_name?:string;last_name?:string;username?:string};
function verifyLogin(user:Login,botToken:string){
  if(!Number.isSafeInteger(user.id)||!Number.isInteger(user.auth_date)||!user.hash||!/^([a-f0-9]{64})$/.test(user.hash))return false;
  if(Math.abs(Date.now()/1000-user.auth_date!)>300)return false;
  const data=Object.entries(user).filter(([key,v])=>key!=="hash"&&v!==undefined&&v!==null).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>key+"="+String(value)).join("\n");
  const secret=createHash("sha256").update(botToken).digest();
  const actual=createHmac("sha256",secret).update(data).digest();
  return timingSafeEqual(actual,Buffer.from(user.hash,"hex"));
}
export async function POST(request:Request){
  if(!env.TELEGRAM_MANAGER_TOKEN||!(env as typeof env & {BOT_STUDIO_AUTH_SECRET?:string}).BOT_STUDIO_AUTH_SECRET)return Response.json({error:"Telegram auth not configured"},{status:503});
  let body:{login?:Login;initData?:string};
  try{const raw=await request.text();if(raw.length>9000)return Response.json({error:"Payload too large"},{status:413});body=JSON.parse(raw);}catch{return Response.json({error:"Invalid request"},{status:400});}
  let identity:Login|null=null;
  if(typeof body.initData==="string"&&body.initData.length<=8192)identity=await verifyTelegramInitData(body.initData,env.TELEGRAM_MANAGER_TOKEN);
  else if(body.login&&verifyLogin(body.login,env.TELEGRAM_MANAGER_TOKEN))identity=body.login;
  if(!identity?.id)return Response.json({error:"Invalid Telegram authentication"},{status:401});
  const db=getSupabaseServer({privileged:true});
  const {data,error}=await db.from("app_users").upsert({telegram_id:identity.id,telegram_username:identity.username??null,first_name:identity.first_name??"Пользователь",last_name:identity.last_name??"",language_code:"ru"},{onConflict:"telegram_id"}).select("id").single();
  if(error||!data)return Response.json({error:"Unable to create session"},{status:503});
  const expires=Date.now()+3600_000;
  const payload=String(identity.id)+"."+String(expires);
  const sig=createHmac("sha256",(env as typeof env & {BOT_STUDIO_AUTH_SECRET?:string}).BOT_STUDIO_AUTH_SECRET).update(payload).digest("hex");
  return Response.json({ok:true},{headers:{"cache-control":"no-store","set-cookie":`bot_studio_telegram_session=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`}});
}
