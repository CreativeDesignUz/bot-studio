import { getSupabaseServer } from "@/lib/supabase/server";
import { clearAuthCookie,readAuthUserId } from "@/lib/auth/account-session";

type LoginInput={provider?:string;accessToken?:string;mode?:"login"|"link"};
import {createAccountSession} from "@/lib/auth/account-service";
function fail(error:string,status:number){return Response.json({error},{status})}
export async function GET(request:Request){
 const signed=await readAuthUserId(request);
 const supabase=getSupabaseServer({privileged:true});
 if(!signed)return Response.json({authenticated:false});
 const {data}=await supabase.from("app_users").select("id,first_name,telegram_username,telegram_id,telegram_oidc_sub,auth_user_id").eq("id",signed).maybeSingle();
 return Response.json(data?{authenticated:true,user:{name:data.first_name,telegram:data.telegram_username,telegramLinked:Boolean(data.telegram_id||data.telegram_oidc_sub),googleLinked:!!data.auth_user_id}}:{authenticated:false},{headers:{"cache-control":"no-store"}});
}

export async function POST(request:Request){
 let payload:LoginInput;
 try{payload=await request.json() as LoginInput}catch{return fail("Неверные данные.",400)}
 if(payload.provider!=="google")return fail("Используйте защищённый Telegram OIDC вход.",400);
 if(!payload.accessToken||payload.accessToken.length>5000)return fail("Google-токен отсутствует.",400);
 const supabase=getSupabaseServer({privileged:true});
 const {data:{user},error}=await supabase.auth.getUser(payload.accessToken);
 if(error||!user||!user.app_metadata?.providers?.includes("google"))return fail("Не удалось проверить Google.",401);
 if(payload.mode==="link"){
  // Explicit account linking only. Never infer ownership by matching email/username.
  const accountId=await readAuthUserId(request);
  if(!accountId)return fail("Сначала войдите в кабинет через Telegram.",401);
  const {data:account,error:accountError}=await supabase.from("app_users").select("id,auth_user_id").eq("id",accountId).maybeSingle();
  if(accountError||!account)return fail("Кабинет не найден. Войдите повторно.",401);
  if(account.auth_user_id&&account.auth_user_id!==user.id)return fail("К кабинету уже привязан другой Google-аккаунт.",409);
  const {data:collision,error:collisionError}=await supabase.from("app_users").select("id").eq("auth_user_id",user.id).maybeSingle();
  if(collisionError)return fail("Не удалось проверить привязку Google.",503);
  if(collision&&collision.id!==accountId)return fail("Этот Google-аккаунт уже принадлежит другому кабинету. Объединение аккаунтов требует отдельного подтверждения.",409);
  if(!account.auth_user_id){
   const {data:linked,error:linkError}=await supabase.from("app_users")
    .update({auth_user_id:user.id}).eq("id",accountId).is("auth_user_id",null).select("id").maybeSingle();
   if(linkError||!linked)return fail("Не удалось безопасно привязать Google. Повторите попытку.",409);
  }
  return Response.json({ok:true,redirectTo:"/workspace/account?linked=1"},{headers:{"cache-control":"no-store"}});
 }
 return createAccountSession(request,{auth_user_id:user.id,first_name:String(user.user_metadata?.full_name??user.user_metadata?.name??user.email?.split("@")[0]??"Google").slice(0,100)},"auth_user_id",user.id);
}

export async function DELETE(){
 return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","set-cookie":clearAuthCookie()}});
}
