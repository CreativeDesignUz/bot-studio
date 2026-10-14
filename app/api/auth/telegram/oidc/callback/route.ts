import { env } from "cloudflare:workers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseServer } from "@/lib/supabase/server";
import { clearGoogleSessionCookies } from "@/lib/auth/google-cookie";

const cookie=(req:Request,name:string)=>(req.headers.get("cookie")??"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="))?.slice(name.length+1)??"";
type JwtPayload={iss?:string;aud?:string|string[];exp?:number;nbf?:number;sub?:string;id?:number;given_name?:string;family_name?:string;preferred_username?:string;name?:string};
async function verifiedTelegramClaims(idToken:string,clientId:string):Promise<JwtPayload> {
 const [headerPart,payloadPart,sigPart,extra]=idToken.split(".");
 if(!headerPart||!payloadPart||!sigPart||extra)throw Error("Bad JWT");
 const header=JSON.parse(Buffer.from(headerPart,"base64url").toString()) as {alg?:string;kid?:string};
 if(header.alg!=="RS256"||!header.kid)throw Error("Unexpected JWT algorithm");
 const response=await fetch("https://oauth.telegram.org/.well-known/jwks.json");
 if(!response.ok)throw Error("Key retrieval failed");
 const jwks=await response.json() as {keys?:Array<JsonWebKey&{kid?:string;alg?:string;use?:string}>};
 const jwk=jwks.keys?.find(k=>k.kid===header.kid&&k.kty==="RSA"&&(!k.use||k.use==="sig"));
 if(!jwk)throw Error("Unknown signing key");
 const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 const ok=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,Buffer.from(sigPart,"base64url"),new TextEncoder().encode(headerPart+"."+payloadPart));
 if(!ok)throw Error("Invalid signature");
 const claims=JSON.parse(Buffer.from(payloadPart,"base64url").toString()) as JwtPayload;
 const now=Math.floor(Date.now()/1000);
 if(claims.iss!=="https://oauth.telegram.org"||!(claims.aud===clientId||Array.isArray(claims.aud)&&claims.aud.includes(clientId))||!claims.exp||claims.exp<=now||claims.nbf&&claims.nbf>now||!claims.sub||!/^\d+$/.test(claims.sub))throw Error("Invalid ID token claims");
 return claims;
}
export async function GET(request:Request){
 const url=new URL(request.url);
 const settings=env as typeof env & {TELEGRAM_OIDC_CLIENT_ID?:string;TELEGRAM_OIDC_CLIENT_SECRET?:string;BOT_STUDIO_AUTH_SECRET?:string};
 if(!settings.TELEGRAM_OIDC_CLIENT_ID||!settings.TELEGRAM_OIDC_CLIENT_SECRET||!settings.BOT_STUDIO_AUTH_SECRET)return Response.json({error:"Telegram OIDC not configured"},{status:503});
 const code=url.searchParams.get("code")??"";
 const state=url.searchParams.get("state")??"";
 const expected=cookie(request,"bs_tg_oidc_state");
 const verifier=cookie(request,"bs_tg_oidc_pkce");
 if(!code||code.length>4096||!state||!expected||!verifier||state.length!==expected.length||!timingSafeEqual(Buffer.from(state),Buffer.from(expected)))return Response.redirect(new URL("/login?error=telegram_session",url.origin),302);
 try{
  const redirect=url.origin+"/api/auth/telegram/oidc/callback";
  const response=await fetch("https://oauth.telegram.org/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded","authorization":"Basic "+Buffer.from(settings.TELEGRAM_OIDC_CLIENT_ID+":"+settings.TELEGRAM_OIDC_CLIENT_SECRET).toString("base64")},body:new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:redirect,client_id:settings.TELEGRAM_OIDC_CLIENT_ID,code_verifier:verifier})});
  if(!response.ok)throw Error("TOKEN_EXCHANGE_"+response.status);
  const token=await response.json() as {id_token?:string};
  if(!token.id_token)throw Error("MISSING_ID_TOKEN");
  const claims=await verifiedTelegramClaims(token.id_token,settings.TELEGRAM_OIDC_CLIENT_ID);
  const database=getSupabaseServer({privileged:true});
  // OIDC 'sub' is a subject string, not necessarily a safe JavaScript integer.
  // The optional 'id' profile claim is the numeric Telegram user ID.
  const tgId = Number.isSafeInteger(claims.id) && (claims.id ?? 0) > 0 ? claims.id : null;
  const profile={telegram_id:tgId,telegram_oidc_sub:claims.sub,first_name:(claims.given_name??claims.name??"Пользователь").slice(0,120),last_name:(claims.family_name??"").slice(0,120),telegram_username:claims.preferred_username??null,language_code:"ru"};
  const {data:existing,error:findError}=await database.from("app_users").select("id").eq("telegram_oidc_sub",claims.sub).maybeSingle();
  if(findError)throw Error("ACCOUNT_LOOKUP");
  const {data,error}=existing
    ? await database.from("app_users").update(profile).eq("id",existing.id).select("id").single()
    : await database.from("app_users").upsert(profile,{onConflict:"telegram_id"}).select("id").single();
  if(error||!data)throw Error("ACCOUNT_SYNC");
  const expires=Date.now()+3600_000;
  const payload=claims.sub+"."+expires;
  const signature=createHmac("sha256",settings.BOT_STUDIO_AUTH_SECRET).update(payload).digest("hex");
  const headers=new Headers({location:new URL("/workspace",url.origin).toString(),"cache-control":"no-store"});
  headers.append("set-cookie",`bot_studio_telegram_session=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`);
  for (const cookie of clearGoogleSessionCookies()) headers.append("set-cookie", cookie);
  headers.append("set-cookie","bs_tg_oidc_state=; Path=/api/auth/telegram/oidc; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  headers.append("set-cookie","bs_tg_oidc_pkce=; Path=/api/auth/telegram/oidc; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return new Response(null,{status:302,headers});
 }catch(e){
  const cause=e instanceof Error?e.message:"UNKNOWN";
  const stage=cause.startsWith("TOKEN_EXCHANGE_")?"token_exchange":cause==="MISSING_ID_TOKEN"?"missing_token":cause==="ACCOUNT_SYNC"?"account_sync":/JWT|signature|claims|signing key|Key retrieval|algorithm/i.test(cause)?"identity_verification":"unexpected";
  console.error("Telegram OIDC failed",{stage,category:e instanceof Error?e.name:"Unknown"});
  return Response.redirect(new URL("/login?error=telegram_auth&stage="+stage,url.origin),302);
 }
}
