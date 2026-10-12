import {env} from "cloudflare:workers";
import {resolveAppUser,withSessionCookie} from "@/lib/auth/app-user";
import {getProjectBotToken} from "@/lib/channels/project-bot-token";
import {telegramCall} from "@/lib/channels/telegram-api";
import {resolvePublicAppOrigin} from "@/lib/http/public-origin";
import {normalizeBotButtons} from "@/lib/telegram/button-actions";
type Payload={initData?:string;botId?:string;name?:string;description?:string;bio?:string;welcome?:string;color?:string;buttons?:unknown};
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export async function POST(request:Request){
 let payload:Payload;
 try{payload=await request.json() as Payload;}catch{return Response.json({error:"Некорректные данные"},{status:400});}
 if(!uuid.test(payload.botId??"")||!payload.name?.trim()||!payload.description?.trim()||payload.name.length>120||payload.description.length>1000)return Response.json({error:"Проверьте название и описание"},{status:400});
 const identity=await resolveAppUser(request,payload.initData??"");
 if("error" in identity)return Response.json({error:identity.error},{status:identity.status});
 const {supabase,user,setCookie}=identity;
 const {data:bot,error:readError}=await supabase.from("bots").select("id,name,description,logo_url,username,settings,template_type").eq("id",payload.botId!).eq("owner_id",user.id).maybeSingle();
 if(readError||!bot)return Response.json({error:"Бот не найден или нет доступа"},{status:404});
 const currentSettings=bot.settings&&typeof bot.settings==="object"&&!Array.isArray(bot.settings)?bot.settings as Record<string,unknown>:{};
 let buttons;
 try{buttons=normalizeBotButtons(payload.buttons??[])}catch{return Response.json({error:"Проверьте действия и адреса кнопок"},{status:400})}
 const settings={...currentSettings,home_buttons:buttons,telegram_bio:payload.bio??currentSettings.telegram_bio??"",welcome_message:payload.welcome??currentSettings.welcome_message??payload.description};
 const [{data:items,itemError},{data:categories,categoryError}]=await Promise.all([
  supabase.from("catalog_items").select("id,name,description,price_minor,currency,image_url,category_id,ingredients,allergens,preparation_minutes,stock_quantity").eq("bot_id",bot.id).eq("is_active",true).order("position",{ascending:true}).limit(250).then(({data,error})=>({data,itemError:error})),
  supabase.from("catalog_categories").select("id,name,position").eq("bot_id",bot.id).eq("is_active",true).order("position",{ascending:true}).limit(100).then(({data,error})=>({data,categoryError:error})),
 ]);
 if(itemError||categoryError)return Response.json({error:"Не удалось проверить каталог для публикации"},{status:503});
 if(["delivery","store"].includes(bot.template_type)&&!(items??[]).length)return Response.json({error:"Перед публикацией добавьте хотя бы один активный товар"},{status:409});
 if((items??[]).some(i=>i.price_minor==null||i.price_minor<0))return Response.json({error:"У активных товаров должна быть цена"},{status:409});
 const {data:channel}=await supabase.from("bot_channels").select("id,status,external_account_id,secret_reference,configuration").eq("bot_id",bot.id).eq("channel","telegram").maybeSingle();
 if(!channel||channel.status!=="connected"||!channel.external_account_id){
  return withSessionCookie({ok:false,requiresTelegramConnection:true,error:"Сначала подключите Telegram-бота" },409,setCookie);
 }
 const bindings=env as typeof env & {TELEGRAM_MANAGER_TOKEN?:string;TELEGRAM_TOKEN_ENCRYPTION_KEY?:string};
 let token:string;
 try{token=await getProjectBotToken(supabase,channel,{managerToken:bindings.TELEGRAM_MANAGER_TOKEN,encryptionKey:bindings.TELEGRAM_TOKEN_ENCRYPTION_KEY});}
 catch{return Response.json({error:"Telegram-канал подключён, но ключ бота недоступен. Повторно проверьте подключение."},{status:503});}
 let origin:string;
 try{origin=resolvePublicAppOrigin(request.url,(env as typeof env&{PUBLIC_APP_URL?:string}).PUBLIC_APP_URL)}catch{return Response.json({error:"Публичный HTTPS-адрес приложения не настроен"},{status:503})}
 const miniAppUrl=new URL("/miniapp?bot="+encodeURIComponent(bot.id),origin).toString();
 const secret=crypto.randomUUID().replaceAll("-","");
 try{
  await telegramCall(token,"setMyName",{name:payload.name.trim().slice(0,64)});
  await telegramCall(token,"setMyDescription",{description:payload.description.trim().slice(0,512)});
  await telegramCall(token,"setMyCommands",{commands:[{command:"start",description:"Открыть главное меню"},{command:"help",description:"Помощь"}]});
  await telegramCall(token,"setChatMenuButton",{menu_button:{type:"web_app",text:"Открыть магазин",web_app:{url:miniAppUrl}}});
  await telegramCall(token,"setWebhook",{url:new URL("/api/channels/telegram/project-runtime?channel="+channel.id,origin).toString(),secret_token:secret,allowed_updates:["message","callback_query"],drop_pending_updates:false});
 }catch{return Response.json({error:"Не удалось настроить Telegram webhook. Публикация не завершена"},{status:503});}
 const name=payload.name.trim(),description=payload.description.trim(),color=/^#[0-9a-f]{6}$/i.test(payload.color??"")?payload.color!:"#6541F5";
 const snapshot={name,description,logo_url:bot.logo_url,primary_color:color,template_type:bot.template_type,settings,catalog:{items:items??[],categories:categories??[]}};
 const oldConfiguration=channel.configuration&&typeof channel.configuration==="object"&&!Array.isArray(channel.configuration)?channel.configuration as Record<string,unknown>:{};
 const {error:channelError}=await supabase.from("bot_channels").update({configuration:{...oldConfiguration,runtime_secret:secret,mini_app_url:miniAppUrl}}).eq("id",channel.id);
 if(channelError)return Response.json({error:"Не удалось сохранить ключ проверки webhook. Публикация не завершена"},{status:503});
 const {data:updated,error:saveError}=await supabase.from("bots").update({name,description,primary_color:color,settings,status:"active",onboarding_stage:"ready",publish_status:"published",published_snapshot:snapshot,publish_error:null}).eq("id",bot.id).eq("owner_id",user.id).select("id").maybeSingle();
 if(saveError||!updated)return Response.json({error:"Telegram настроен, но сохранить опубликованную версию не удалось. Повторите публикацию"},{status:503});
 await supabase.from("bot_events").insert({bot_id:bot.id,event_type:"bot_published",actor_external_id:user.telegram_id?String(user.telegram_id):"web",payload:{source:"builder"}});
 return withSessionCookie({ok:true,botId:bot.id,status:"published",miniAppUrl,publishedAt:new Date().toISOString()},200,setCookie);
}
