import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { issueAuthCookie,clearAuthCookie,readAuthUserId } from "@/lib/auth/account-session";

type LoginInput={provider?:string;accessToken?:string;telegram?:Record<string,unknown>};
function fail(error:string,status:number){return Response.json({error},{status})}
async function telegramIdentity(raw:Record<string,unknown>){
 const token=env.TELEGRAM_LOGIN_BOT_TOKEN??env.TELEGRAM_MANAGER_TOKEN;
 if(!token)return null;
 const hash=raw.hash;
 const authDate=raw.auth_date;
 const id=raw.id;
 if(typeof hash!=="string"||!/^[a-f0-9]{64}$/i.test(hash)||!/^[0-9]{8,}$/.test(String(id))||!/^[0-9]{10}$/.test(String(authDate)))return null;
 const age=Math.abs(Math.floor(Date.now()/1000)-Number(authDate));
 if(age>300)return null;
 const allowed=["id","first_name","last_name","username","photo_url","auth_date"];
 const entries=Object.entries(raw).filter(([key,value])=>allowed.includes(key)&&typeof value!=="object"&&value!==undefined).map(([key,value])=>[key,String(value)] as const);
 const dataCheck=entries.sort(([a],[b])=>a.localeCompare(b,"en")).map(([key,value])=>`${key}=${value}`).join("\n");
 const secret=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
 const key=await crypto.subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(dataCheck)));
 const provided=Uint8Array.from(hash.match(/../g)??[],pair=>parseInt(pair,16));
 if(provided.length!==signed.length)return null;
 let diff=0;for(let i=0;i<signed.length;i++)diff|=signed[i]^provided[i];
 if(diff!==0)return null;
 return {id:String(id),first_name:typeof raw.first_name==="string"?raw.first_name.slice(0,100):"Telegram",last_name:typeof raw.last_name==="string"?raw.last_name.slice(0,100):"",username:typeof raw.username==="string"?raw.username.slice(0,100):null};
}
function readGuestHash(request:Request){
 const cookie=(request.headers.get("cookie")??"").split(";").map(x=>x.trim()).find(x=>x.startsWith("bot_studio_session="))?.slice("bot_studio_session=".length);
 return cookie&&/^[a-f0-9]{64}$/.test(cookie)?cookie:null;
}
async function hexSha(input:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input))),byte=>byte.toString(16).padStart(2,"0")).join("")}

export async function GET(request:Request){
 const signed=await readAuthUserId(request);
 const supabase=getSupabaseServer({privileged:true});
 if(!signed)return Response.json({authenticated:false});
 const {data}=await supabase.from("app_users").select("id,first_name,telegram_username,auth_user_id").eq("id",signed).maybeSingle();
 return Response.json(data?{authenticated:true,user:{name:data.first_name,telegram:data.telegram_username,googleLinked:!!data.auth_user_id}}:{authenticated:false});
}

export async function POST(request:Request){
 let payload:LoginInput;
 try{payload=await request.json() as LoginInput}catch{return fail("Неверные данные.",400)}
 const supabase=getSupabaseServer({privileged:true});
 let account:Record<string,unknown>;
 let identityKey:"auth_user_id"|"telegram_id";
 let identityValue:string;
 if(payload.provider==="google"){
  if(!payload.accessToken||payload.accessToken.length>5000)return fail("Google-токен отсутствует.",400);
  const {data:{user},error}=await supabase.auth.getUser(payload.accessToken);
  if(error||!user||user.app_metadata?.provider!=="google")return fail("Не удалось проверить Google.",401);
  identityKey="auth_user_id";identityValue=user.id;
  account={auth_user_id:user.id,first_name:String(user.user_metadata?.full_name??user.user_metadata?.name??user.email?.split("@")[0]??"Google").slice(0,100)};
 }else if(payload.provider==="telegram"){
  if(!payload.telegram||typeof payload.telegram!=="object")return fail("Нет данных Telegram.",400);
  const tg=await telegramIdentity(payload.telegram);
  if(!tg)return fail("Telegram не подтвердил вход.",401);
  identityKey="telegram_id";identityValue=tg.id;
  account={telegram_id:tg.id,telegram_username:tg.username,first_name:tg.first_name,last_name:tg.last_name};
 }else return fail("Неизвестный способ входа.",400);

 const {data:existing,error:lookupError}=await supabase.from("app_users").select("id").eq(identityKey,identityValue).maybeSingle();
 if(lookupError)return fail("Не удалось проверить аккаунт.",503);
 let id:string;
 if(existing)id=existing.id;
 else{
  // Attach a previously created anonymous bot workspace to the verified account.
  // Never overwrite an already claimed Google/Telegram identity.
  const guest=readGuestHash(request),hash=guest?await hexSha(guest):null;
  const {data:unclaimed}=hash?await supabase.from("app_users").select("id,auth_user_id,telegram_id").eq("web_session_hash",hash).maybeSingle():{data:null};
  if(unclaimed&&!unclaimed.auth_user_id&&!unclaimed.telegram_id){
   const {data:linked,error:linkError}=await supabase.from("app_users").update(account).eq("id",unclaimed.id).is("auth_user_id",null).is("telegram_id",null).select("id").maybeSingle();
   if(linkError||!linked)return fail("Не удалось привязать существующий кабинет.",409);
   id=linked.id;
  }else{
   const {data:created,error:createError}=await supabase.from("app_users").insert({...account,language_code:"ru"}).select("id").single();
   if(createError||!created)return fail("Не удалось создать аккаунт.",503);
   id=created.id;
  }
 }
 let cookie:string;
 try{cookie=await issueAuthCookie(id)}catch{return fail("Вход ещё не настроен на сервере. Требуется BOT_STUDIO_AUTH_SECRET.",503)}
 return new Response(JSON.stringify({ok:true,redirectTo:"/workspace"}),{status:200,headers:{"content-type":"application/json","set-cookie":cookie,"cache-control":"no-store"}});
}
export async function DELETE(){
 return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","set-cookie":clearAuthCookie()}});
}
