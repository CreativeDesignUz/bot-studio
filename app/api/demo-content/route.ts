import {resolveAppUser,withSessionCookie} from "@/lib/auth/app-user";

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const bad=(error:string,status:number)=>Response.json({error},{status,headers:{"cache-control":"no-store"}});
async function owner(request:Request,botId:string,initData:string){
 if(!uuid.test(botId))return {error:bad("Укажите корректного бота.",400)} as const;
 const auth=await resolveAppUser(request,initData);
 if("error" in auth)return {error:bad(auth.error??"Войдите в аккаунт.",auth.status??401)} as const;
 const {data:bot,error}=await auth.supabase.from("bots")
  .select("id,template_type,status,publish_status,settings")
  .eq("id",botId).eq("owner_id",auth.user.id).maybeSingle();
 if(error)return {error:bad("Не удалось проверить владельца бота.",503)} as const;
 if(!bot)return {error:bad("Нет доступа к этому боту.",403)} as const;
 if(!["delivery","store"].includes(bot.template_type))return {error:bad("Демо-контент доступен для доставки и магазина.",400)} as const;
 return {auth,bot} as const;
}
type RequestPayload={botId?:unknown;initData?:unknown;confirm?:unknown};
async function parse(request:Request){
 try{
  const body=await request.json() as RequestPayload;
  if(!body||typeof body!=="object"||Array.isArray(body))return null;
  return body;
 }catch{return null;}
}
export async function GET(request:Request){
 const botId=new URL(request.url).searchParams.get("bot")??"";
 const result=await owner(request,botId,request.headers.get("x-telegram-init-data")??"");
 if("error" in result)return result.error;
 const imported=Boolean(result.bot.settings&&
  typeof result.bot.settings==="object"&&
  (result.bot.settings as Record<string,unknown>).demo_content);
 const {data,error}=await result.auth.supabase.from("bot_demo_notifications")
  .select("id,title,body,created_at").eq("bot_id",botId)
  .order("created_at",{ascending:false}).limit(10);
 if(error)return bad("Не удалось загрузить уведомления.",503);
 return withSessionCookie({
  imported,canImport:result.bot.status==="draft"&&result.bot.publish_status==="not_published",
  notifications:data??[]
 },200,result.auth.setCookie);
}
export async function POST(request:Request){
 const input=await parse(request);
 if(!input||input.confirm!=="IMPORT_DEMO_CONTENT")return bad("Подтвердите импорт демо-данных.",400);
 const botId=typeof input.botId==="string"?input.botId:"";
 const result=await owner(request,botId,typeof input.initData==="string"?input.initData:"");
 if("error" in result)return result.error;
 if(result.bot.status!=="draft"||result.bot.publish_status!=="not_published")
  return bad("Импорт доступен только в неопубликованном черновике.",409);
 const {data,error}=await result.auth.supabase.rpc("seed_bot_studio_demo_content",{p_bot_id:botId});
 if(error)return bad(error.message.includes("черновик")?"Демо можно загрузить только до публикации.":"Не удалось создать демо-данные. Попробуйте ещё раз.",409);
 return withSessionCookie({ok:true,...(data&&typeof data==="object"?data:{})},200,result.auth.setCookie);
}
export async function DELETE(request:Request){
 const input=await parse(request);
 if(!input||input.confirm!=="REMOVE_DEMO_CONTENT")return bad("Подтвердите удаление демо-данных.",400);
 const botId=typeof input.botId==="string"?input.botId:"";
 const result=await owner(request,botId,typeof input.initData==="string"?input.initData:"");
 if("error" in result)return result.error;
 if(result.bot.status!=="draft"||result.bot.publish_status!=="not_published")
  return bad("Демо-данные можно удалить только до публикации.",409);
 const {data,error}=await result.auth.supabase.rpc("remove_bot_studio_demo_content",{p_bot_id:botId});
 if(error)return bad("Не удалось удалить демо-данные. Повторите попытку.",409);
 return withSessionCookie({ok:true,...(data&&typeof data==="object"?data:{})},200,result.auth.setCookie);
}
