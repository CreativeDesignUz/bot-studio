import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { issueAuthCookie,clearAuthCookie,readAuthUserId } from "@/lib/auth/account-session";

type LoginInput={provider?:string;accessToken?:string;telegram?:Record<string,unknown>};
import {createAccountSession} from "@/lib/auth/account-service";
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
 if(payload.provider!=="google")return fail("Используйте защищённый Telegram OIDC вход.",400);
 if(!payload.accessToken||payload.accessToken.length>5000)return fail("Google-токен отсутствует.",400);
 const supabase=getSupabaseServer({privileged:true});
 const {data:{user},error}=await supabase.auth.getUser(payload.accessToken);
 if(error||!user||user.app_metadata?.provider!=="google")return fail("Не удалось проверить Google.",401);
 return createAccountSession(request,{auth_user_id:user.id,first_name:String(user.user_metadata?.full_name??user.user_metadata?.name??user.email?.split("@")[0]??"Google").slice(0,100)},"auth_user_id",user.id);
}

export async function DELETE(){
 return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","set-cookie":clearAuthCookie()}});
}
