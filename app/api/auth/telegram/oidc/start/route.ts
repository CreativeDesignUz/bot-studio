import { env } from "cloudflare:workers";
import { randomBytes, createHash } from "node:crypto";

const b64=(b:Buffer)=>b.toString("base64url");
export async function GET(request:Request) {
 const e=env as typeof env & {TELEGRAM_OIDC_CLIENT_ID?:string};
 const clientId=e.TELEGRAM_OIDC_CLIENT_ID;
 if(!clientId || !/^\d+$/.test(clientId)) return Response.json({error:"Telegram OIDC is not configured"},{status:503});
 const url=new URL(request.url);
 const redirect=url.origin+"/api/auth/telegram/oidc/callback";
 const verifier=b64(randomBytes(32));
 const state=b64(randomBytes(24));
 const challenge=b64(createHash("sha256").update(verifier).digest());
 const target=new URL("https://oauth.telegram.org/auth");
 target.searchParams.set("client_id",clientId);
 target.searchParams.set("redirect_uri",redirect);
 target.searchParams.set("response_type","code");
 target.searchParams.set("scope","openid profile");
 target.searchParams.set("state",state);
 target.searchParams.set("code_challenge",challenge);
 target.searchParams.set("code_challenge_method","S256");
 const headers=new Headers({location:target.toString(),"cache-control":"no-store"});
 headers.append("set-cookie",`bs_tg_oidc_state=${state}; Path=/api/auth/telegram/oidc; HttpOnly; Secure; SameSite=Lax; Max-Age=300`);
 headers.append("set-cookie",`bs_tg_oidc_pkce=${verifier}; Path=/api/auth/telegram/oidc; HttpOnly; Secure; SameSite=Lax; Max-Age=300`);
 return new Response(null,{status:302,headers});
}
