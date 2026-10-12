import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getProjectBotToken } from "@/lib/channels/project-bot-token";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

const fail=(error:string,status:number)=>Response.json({error},{status});
const uuid=(v:unknown)=>typeof v==="string" && /^[0-9a-f-]{36}$/i.test(v);
type Input={botId?:string;itemId?:string;initData?:string;requestKey?:string;name?:string;phone?:string;brief?:string};

async function session(botId:string,initData:string){
  const db=getSupabaseServer({privileged:true});
  const {data:bot}=await db.from("bots").select("template_type,status,publish_status").eq("id",botId).maybeSingle();
  if(bot?.template_type!=="service"||bot.status!=="active"||bot.publish_status!=="published")return null;
  const {data:channel}=await db.from("bot_channels").select("external_account_id,status,secret_reference,configuration").eq("bot_id",botId).eq("channel","telegram").maybeSingle();
  if(!channel||channel.status!=="connected")return null;
  const token=await getProjectBotToken(db,channel,{managerToken:env.TELEGRAM_MANAGER_TOKEN,encryptionKey:env.TELEGRAM_TOKEN_ENCRYPTION_KEY});
  const user=await verifyTelegramInitData(initData,token);
  return user?{db,user}:null;
}
export async function GET(request:Request){
  const u=new URL(request.url),botId=u.searchParams.get("bot")??"",initData=request.headers.get("x-telegram-init-data")??"";
  if(!uuid(botId)||!initData)return fail("Откройте услуги через Telegram.",401);
  try{
    const auth=await session(botId,initData);if(!auth)return fail("Нет доступа к заявкам.",401);
    const {data,error}=await auth.db.from("orders").select("id,status,payment_status,total_minor,currency,created_at,payload,order_items(item_name)").eq("bot_id",botId).eq("customer_external_id",String(auth.user.id)).contains("payload",{source:"service_request"}).order("created_at",{ascending:false}).limit(50);
    return error?fail("Не удалось загрузить заявки.",503):Response.json({requests:data??[]});
  }catch{return fail("Временная ошибка загрузки заявок.",503)}
}
export async function POST(request:Request){
  let p:Input;try{p=await request.json() as Input}catch{return fail("Некорректный запрос.",400)}
  const name=(p.name??"").trim(),brief=(p.brief??"").trim(),phone=(p.phone??"").trim();
  if(!uuid(p.botId)||!uuid(p.itemId)||!p.initData||!/^[A-Za-z0-9_-]{16,128}$/.test(p.requestKey??"")||name.length<2||name.length>100||brief.length<5||brief.length>2000||phone.length>40)return fail("Проверьте поля заявки.",400);
  try{
    const auth=await session(p.botId!,p.initData);if(!auth)return fail("Нет доступа.",401);
    const {data:item}=await auth.db.from("catalog_items").select("id,name,price_minor").eq("bot_id",p.botId!).eq("id",p.itemId!).eq("item_type","service").eq("is_active",true).maybeSingle();
    if(!item||item.price_minor==null)return fail("Услуга недоступна.",409);
    const {data,error}=await auth.db.rpc("create_miniapp_order",{p_bot_id:p.botId,p_customer_external_id:String(auth.user.id),p_customer_name:name,p_fulfillment:"pickup",p_delivery_address:"",p_items:[{id:item.id,quantity:1}],p_request_key:p.requestKey});
    if(error||!data)return fail("Не удалось создать заявку.",503);
    const out=data as {orderId:string;replayed?:boolean};
    if(!out.replayed){
      const {error:updateError}=await auth.db.from("orders").update({payload:{source:"service_request",mode:"request",format:"online",pricing:"fixed",payment_timing:"after_confirmation",service_id:item.id,service_name:item.name,brief,phone}}).eq("id",out.orderId).eq("bot_id",p.botId!);
      if(updateError)return fail("Заявка создана, но детали не сохранены. Обратитесь к продавцу.",503);
    }
    return Response.json({requestId:out.orderId,status:"new",replayed:!!out.replayed},{status:out.replayed?200:201});
  }catch{return fail("Не удалось отправить заявку.",503)}
}
