import {oidcConfig,readStateCookie,verifyState,redirectUri,verifyIdToken,clearStateCookie} from "@/lib/auth/telegram-oidc";
import {verifiedTelegramSession} from "@/lib/auth/account-service";
function fail(request:Request,reason:string){
 return new Response(null,{status:302,headers:{"location":new URL("/auth?error="+encodeURIComponent(reason),request.url).toString(),"set-cookie":clearStateCookie(),"cache-control":"no-store"}});
}
export async function GET(request:Request){
 const url=new URL(request.url),config=oidcConfig(),raw=readStateCookie(request);
 if(!config||!raw)return fail(request,"telegram_session_expired");
 const session=await verifyState(raw);
 const code=url.searchParams.get("code"),state=url.searchParams.get("state");
 if(!session||!code||code.length>2048||state!==session.state||url.searchParams.has("error"))return fail(request,"telegram_state_invalid");
 try{
  const response=await fetch("https://oauth.telegram.org/token",{
   method:"POST",headers:{"authorization":"Basic "+btoa(config.id+":"+config.secret),"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:redirectUri(request),client_id:config.id,code_verifier:session.verifier}),signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)return fail(request,"telegram_exchange_failed");
  const token=await response.json() as {id_token?:string};
  if(!token.id_token)return fail(request,"telegram_missing_identity");
  const identity=await verifyIdToken(token.id_token,config.id);
  const result=await verifiedTelegramSession(request,identity);
  if(!result.ok)return fail(request,"telegram_account_failed");
  const cookie=result.headers.get("set-cookie");
  const headers=new Headers({"location":new URL("/workspace",request.url).toString(),"cache-control":"no-store"});
  if(cookie)headers.append("set-cookie",cookie);
  headers.append("set-cookie",clearStateCookie());
  return new Response(null,{status:303,headers});
 }catch{return fail(request,"telegram_login_failed");}
}
