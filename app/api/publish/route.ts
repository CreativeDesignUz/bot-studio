import { env } from "cloudflare:workers";
import { telegramCall } from "@/lib/channels/telegram-api";
import { getManagedBotToken } from "@/lib/channels/telegram-api";
import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

type PublishPayload={initData?:string;botId?:string;name?:string;description?:string;color?:string;buttons?:{label?:string;action?:string}[]};

export async function POST(request:Request){
 const payload=await request.json() as PublishPayload;
 if(!payload.botId||!payload.name?.trim()||!payload.description?.trim())return Response.json({error:"Заполните название и описание."},{status:400});
 const identity=await resolveAppUser(request,payload.initData??"");
 if("error" in identity)return Response.json({error:identity.error},{status:identity.status});
 const {supabase,user:appUser,setCookie}=identity;
 const {data:bot,error}=await supabase.from("bots").update({name:payload.name.trim(),description:payload.description.trim(),primary_color:payload.color??"#6541F5",settings:{home_buttons:payload.buttons??[]},status:"active",onboarding_stage:"ready"}).eq("id",payload.botId).eq("owner_id",appUser.id).select("id,name,username").single();
 if(error||!bot)return Response.json({error:error?.message??"Бот не найден."},{status:404});
 await supabase.from("bot_events").insert({bot_id:bot.id,event_type:"bot_published",actor_external_id:appUser.telegram_id?String(appUser.telegram_id):"web",payload:{source:payload.initData?"mini_app":"web"}});
 const origin=new URL(request.url).origin;
 const {data:channel}=await supabase.from("bot_channels").select("id,status,external_account_id,external_username,configuration").eq("bot_id",bot.id).eq("channel","telegram").maybeSingle();
 if(channel?.status==="connected"&&channel.external_account_id&&env.TELEGRAM_MANAGER_TOKEN){
  const token=await getManagedBotToken(env.TELEGRAM_MANAGER_TOKEN,channel.external_account_id);
  const runtimeSecret=crypto.randomUUID().replaceAll("-","");
  const workspaceUrl=new URL(`/workspace?bot=${bot.id}`,origin).toString();
  await Promise.all([
   telegramCall(token,"setMyName",{name:bot.name.slice(0,64)}),
   telegramCall(token,"setMyDescription",{description:payload.description.trim().slice(0,512)}),
   telegramCall(token,"setChatMenuButton",{menu_button:{type:"web_app",text:"Открыть",web_app:{url:workspaceUrl}}}),
   telegramCall(token,"setWebhook",{url:new URL(`/api/channels/telegram/project-runtime?channel=${channel.id}`,origin).toString(),secret_token:runtimeSecret,allowed_updates:["message"]}),
  ]);
  await supabase.from("bot_channels").update({configuration:{...(channel.configuration??{}),runtime_secret:runtimeSecret,mini_app_url:workspaceUrl}}).eq("id",channel.id);
  return withSessionCookie({ok:true,botId:bot.id,status:"published",publishedAt:new Date().toISOString()},200,setCookie);
 }
 const manager=(env.TELEGRAM_MANAGER_USERNAME??"").replace(/^@/,"");
 if(!manager)return withSessionCookie({ok:true,botId:bot.id,status:"saved",requiresTelegramConnection:true},200,setCookie);
 const suggested=(bot.username||`studio_${bot.id.replaceAll("-","").slice(0,12)}_bot`).replace(/^@/,"");
 const connectUrl=`https://t.me/newbot/${manager}/${suggested}?name=${encodeURIComponent(bot.name.slice(0,64))}`;
 await supabase.from("bot_channels").upsert({bot_id:bot.id,channel:"telegram",status:"pending",external_username:suggested,configuration:{connect_url:connectUrl}},{onConflict:"bot_id,channel"});
 return withSessionCookie({ok:true,botId:bot.id,status:"saved",requiresTelegramConnection:true,connectUrl},200,setCookie);
}
