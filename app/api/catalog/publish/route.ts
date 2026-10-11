import {resolveAppUser,withSessionCookie} from "@/lib/auth/app-user";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(error:string,status:number)=>Response.json({error},{status,headers:{"cache-control":"no-store"}});
async function owner(request:Request,botId:string,initData:string){
 if(!uuid.test(botId))return {error:fail("Выберите корректного бота.",400)} as const;
 const auth=await resolveAppUser(request,initData);
 if("error" in auth)return {error:fail(auth.error??"Войдите в аккаунт.",auth.status??401)} as const;
 const {data,error}=await auth.supabase.from("bots").select("id,template_type")
  .eq("id",botId).eq("owner_id",auth.user.id).maybeSingle();
 if(error)return {error:fail("Не удалось проверить владельца бота.",503)} as const;
 if(!data)return {error:fail("У вас нет доступа к этому боту.",403)} as const;
 if(data.template_type!=="store"&&data.template_type!=="delivery")
  return {error:fail("Обновление каталога доступно для магазина и доставки.",400)} as const;
 return {auth} as const;
}

export async function GET(request:Request){
 const botId=new URL(request.url).searchParams.get("bot")??"";
 const access=await owner(request,botId,request.headers.get("x-telegram-init-data")??"");
 if("error" in access)return access.error;
 const {data,error}=await access.auth.supabase.rpc("bot_studio_catalog_publication_status",{
  p_bot_id:botId,p_owner_id:access.auth.user.id
 });
 if(error||!data)return fail("Не удалось проверить опубликованный каталог.",503);
 return withSessionCookie(data,200,access.auth.setCookie);
}

export async function POST(request:Request){
 let input:{botId?:unknown;initData?:unknown;confirm?:unknown;expectedRevision?:unknown};
 try{
  const value:unknown=await request.json();
  if(!value||typeof value!=="object"||Array.isArray(value))return fail("Некорректный запрос.",400);
  input=value as typeof input;
 }catch{return fail("Некорректный запрос.",400);}
 if(input.confirm!=="PUBLISH_CATALOG")return fail("Подтвердите обновление Mini App.",400);
 if(!Number.isSafeInteger(input.expectedRevision)||Number(input.expectedRevision)<0)
  return fail("Обновите страницу и повторите публикацию.",400);
 const botId=typeof input.botId==="string"?input.botId:"";
 const access=await owner(request,botId,typeof input.initData==="string"?input.initData:"");
 if("error" in access)return access.error;
 const {data,error}=await access.auth.supabase.rpc("bot_studio_republish_catalog",{
  p_bot_id:botId,p_owner_id:access.auth.user.id,p_expected_revision:input.expectedRevision
 });
 if(error){
  if(error.message.includes("REVISION_CONFLICT")||error.code==="40001")
   return fail("Кто-то уже обновил каталог. Обновите страницу и проверьте изменения.",409);
  if(error.message.includes("REMOVE_DEMO"))
   return fail("Перед публикацией удалите демо-данные в разделе «Меню».",409);
  if(error.message.includes("BOT_NOT_PUBLISHED"))
   return fail("Сначала опубликуйте самого бота через мастер запуска.",409);
  return fail("Не удалось обновить опубликованный каталог. Повторите попытку.",503);
 }
 return withSessionCookie({ok:true,...(data&&typeof data==="object"?data:{})},200,access.auth.setCookie);
}
