import {oidcConfig,randomUrlString,challenge,signedState,stateCookie,redirectUri} from "@/lib/auth/telegram-oidc";
export async function GET(request:Request){
 const config=oidcConfig();
 if(!config)return Response.redirect(new URL("/auth?error=telegram_not_configured",request.url));
 const state=randomUrlString(),verifier=randomUrlString(48),created=String(Date.now());
 const value=[state,verifier,created,await signedState(state,verifier+"."+created)].join(".");
 const url=new URL("https://oauth.telegram.org/auth");
 url.searchParams.set("client_id",config.id);
 url.searchParams.set("redirect_uri",redirectUri(request));
 url.searchParams.set("response_type","code");
 url.searchParams.set("scope","openid profile");
 url.searchParams.set("state",state);
 url.searchParams.set("code_challenge",await challenge(verifier));
 url.searchParams.set("code_challenge_method","S256");
 return new Response(null,{status:302,headers:{"location":url.toString(),"set-cookie":stateCookie(value),"cache-control":"no-store"}});
}
