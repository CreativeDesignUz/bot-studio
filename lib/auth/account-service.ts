import {getSupabaseServer} from "@/lib/supabase/server";
import {issueAuthCookie} from "@/lib/auth/account-session";
function fail(error:string,status:number){return Response.json({error},{status})}
function readGuestHash(request:Request){const cookie=(request.headers.get("cookie")??"").split(";").map(x=>x.trim()).find(x=>x.startsWith("bot_studio_session="))?.slice("bot_studio_session=".length);return cookie&&/^[a-f0-9]{64}$/.test(cookie)?cookie:null;}
async function hexSha(input:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input))),byte=>byte.toString(16).padStart(2,"0")).join("")}
export type VerifiedTelegramIdentity={id:string;first_name:string;last_name:string;username:string|null};
export async function verifiedTelegramSession(request:Request,tg:VerifiedTelegramIdentity){
 return createAccountSession(request,{telegram_oidc_sub:tg.id,telegram_username:tg.username,first_name:tg.first_name,last_name:tg.last_name},"telegram_oidc_sub",tg.id);
}
export async function createAccountSession(request:Request,account:Record<string,unknown>,identityKey:"auth_user_id"|"telegram_id"|"telegram_oidc_sub",identityValue:string){
 const supabase=getSupabaseServer({privileged:true});
 const {data:existing,error:lookupError}=await supabase.from("app_users").select("id").eq(identityKey,identityValue).maybeSingle();
 if(lookupError)return fail("Не удалось проверить аккаунт.",503);
 let id:string;
 if(existing)id=existing.id;
 else{
  // Attach a previously created anonymous bot workspace to the verified account.
  // Never overwrite an already claimed Google/Telegram identity.
  const guest=readGuestHash(request),hash=guest?await hexSha(guest):null;
  const {data:unclaimed}=hash?await supabase.from("app_users").select("id,auth_user_id,telegram_id,telegram_oidc_sub").eq("web_session_hash",hash).maybeSingle():{data:null};
  if(unclaimed&&!unclaimed.auth_user_id&&!unclaimed.telegram_id&&!unclaimed.telegram_oidc_sub){
   const {data:linked,error:linkError}=await supabase.from("app_users").update({...account,web_session_hash:null}).eq("id",unclaimed.id).is("auth_user_id",null).is("telegram_id",null).is("telegram_oidc_sub",null).select("id").maybeSingle();
   if(linkError||!linked)return fail("Не удалось привязать существующий кабинет.",409);
   id=linked.id;
  }else{
   const {data:created,error:createError}=await supabase.from("app_users").insert({...account,language_code:"ru"}).select("id").single();
   if(createError||!created)return fail("Не удалось создать аккаунт.",503);
   id=created.id;
  }
 }
 // Revoke legacy guest access after successful verified login.
 await supabase.from("app_users").update({web_session_hash:null}).eq("id",id);
 let cookie:string;
 try{cookie=await issueAuthCookie(id)}catch{return fail("Вход ещё не настроен на сервере. Требуется BOT_STUDIO_AUTH_SECRET.",503)}
 return new Response(JSON.stringify({ok:true,redirectTo:"/workspace"}),{status:200,headers:{"content-type":"application/json","set-cookie":cookie,"cache-control":"no-store"}});
}
