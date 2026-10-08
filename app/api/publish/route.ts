import { env } from "cloudflare:workers";
import { telegramCall } from "@/lib/channels/telegram-api";
import { getSupabaseServer } from "@/lib/supabase/server";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

type PublishPayload={initData?:string;botId?:string;name?:string;description?:string;color?:string;buttons?:{label?:string;action?:string}[]};

export async function POST(request:Request){
 if(!env.TELEGRAM_MANAGER_TOKEN)return Response.json({error:"Telegram пока не подключён. Добавьте новый токен менеджер-бота."},{status:503});
 if(!env.SUPABASE_SECRET_KEY)return Response.json({error:"Supabase server access is not configured"},{status:503});
 const payload=await request.json() as PublishPayload;
 const telegramUser=await verifyTelegramInitData(payload.initData??"",env.TELEGRAM_MANAGER_TOKEN);
 if(!telegramUser)return Response.json({error:"Для первой публикации откройте редактор внутри Telegram Mini App."},{status:401});
 if(!payload.botId||!payload.name?.trim()||!payload.description?.trim())return Response.json({error:"Заполните название и описание."},{status:400});
 const supabase=getSupabaseServer({privileged:true});
 const {data:appUser}=await supabase.from("app_users").select("id").eq("telegram_id",telegramUser.id).single();
 if(!appUser)return Response.json({error:"Пользователь не найден."},{status:404});
 const {data:bot,error}=await supabase.from("bots").update({name:payload.name.trim(),description:payload.description.trim(),primary_color:payload.color??"#6541F5",settings:{home_buttons:payload.buttons??[]},status:"active",onboarding_stage:"ready"}).eq("id",payload.botId).eq("owner_id",appUser.id).select("id").single();
 if(error||!bot)return Response.json({error:error?.message??"Бот не найден."},{status:404});
 await supabase.from("bot_events").insert({bot_id:bot.id,event_type:"bot_published",actor_external_id:String(telegramUser.id),payload:{source:"mini_app"}});
 const origin=new URL(request.url).origin;
 await telegramCall(env.TELEGRAM_MANAGER_TOKEN,"setChatMenuButton",{menu_button:{type:"web_app",text:"Открыть студию",web_app:{url:new URL("/workspace",origin).toString()}}});
 return Response.json({ok:true,botId:bot.id,publishedAt:new Date().toISOString()});
}
