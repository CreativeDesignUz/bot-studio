import { normalizeBotButtons, telegramInlineKeyboard } from "@/lib/telegram/button-actions";
import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getManagedBotToken, telegramCall } from "@/lib/channels/telegram-api";

type RuntimeUpdate={message?:{text?:string;chat?:{id?:number};from?:{id?:number;first_name?:string;username?:string}};callback_query?:{id?:string;data?:string;message?:{chat?:{id?:number}};from?:{id?:number}}};

export async function POST(request:Request){
 if(!env.TELEGRAM_MANAGER_TOKEN||!env.SUPABASE_SECRET_KEY)return new Response("Not configured",{status:503});
 const channelId=new URL(request.url).searchParams.get("channel")??"";
 const supabase=getSupabaseServer({privileged:true});
 const {data:channel}=await supabase.from("bot_channels").select("id,bot_id,external_account_id,configuration").eq("id",channelId).single();
 const secret=(channel?.configuration as {runtime_secret?:string}|null)?.runtime_secret;
 if(!channel?.external_account_id||!secret||request.headers.get("x-telegram-bot-api-secret-token")!==secret)return new Response("Forbidden",{status:403});
 const update=await request.json() as RuntimeUpdate;
 const chatId=update.callback_query?.message?.chat?.id??update.message?.chat?.id;
 const text=update.message?.text?.trim();
 const from=update.message?.from;
 if(!chatId || (!text && !update.callback_query)) return Response.json({ok:true});
 const {data:bot}=await supabase.from("bots").select("name,description,settings,status,publish_status,published_snapshot").eq("id",channel.bot_id).single();
 if(!bot||bot.status!=="active"||bot.publish_status!=="published")return Response.json({ok:true});
 if(from?.id){
  await supabase.from("customers").upsert({bot_id:channel.bot_id,external_id:String(from.id),full_name:from.first_name??"",telegram_username:from.username??null,last_activity_at:new Date().toISOString()},{onConflict:"bot_id,external_id"});
  await supabase.from("bot_events").insert({bot_id:channel.bot_id,event_type:"telegram_message",actor_external_id:String(from.id),payload:{text:(text??"").slice(0,200)}});
 }
 const published=(bot.published_snapshot??{}) as {name?:string;description?:string;settings?:{home_buttons?:{label?:string;action?:string}[]}};
 const publishedName=published.name??bot.name,publishedDescription=published.description??bot.description;
 const configuredButtons=((published.settings??bot.settings as {home_buttons?:{label?:string;action?:string}[]}|null)?.home_buttons??[]).slice(0,8);
 const buttons=normalizeBotButtons(configuredButtons);
 const origin=new URL(request.url).origin;
 const token=await getManagedBotToken(env.TELEGRAM_MANAGER_TOKEN,channel.external_account_id);
 if(update.callback_query){
  const query=update.callback_query;
  const match=/^reply:([0-7])$/.exec(query.data??"");
  const selected=match ? buttons[Number(match[1])] : null;
  await telegramCall(token,"answerCallbackQuery",{callback_query_id:query.id,text:selected?.action==="reply"?"":"Кнопка недоступна"}).catch(()=>undefined);
  if(selected?.action==="reply" && selected.replyText){
   await telegramCall(token,"sendMessage",{chat_id:chatId,text:selected.replyText});
  }
  return Response.json({ok:true});
 }
 if(/^\/start(?:@\w+)?(?:\s|$)/.test(text)){
  await telegramCall(token,"sendMessage",{chat_id:chatId,text:`${publishedName}\n\n${publishedDescription}`,reply_markup:{inline_keyboard:telegramInlineKeyboard(buttons,new URL(`/miniapp?bot=${channel.bot_id}`,origin).toString())}});
 }else{
  await telegramCall(token,"sendMessage",{chat_id:chatId,text:"Откройте приложение — там доступны каталог, заказы и поддержка.",reply_markup:{inline_keyboard:[[{text:"Открыть приложение",web_app:{url:new URL(`/miniapp?bot=${channel.bot_id}`,origin).toString()}}]]}});
 }
 return Response.json({ok:true});
}
