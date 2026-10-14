import { createHash, randomBytes } from "node:crypto";
// Read-only checks against the actual deployed Staging Worker, not source-code presence.
const base=process.env.BOT_STUDIO_STAGING_URL??"https://bot-studio-staging.slavnauz.workers.dev";
const bot="39237fdd-ec5d-415e-8634-e20c1d66edd1";
let failures=0;
async function check(name,path,accept){
  try{
    const response=await fetch(new URL(path,base),{redirect:"manual",signal:AbortSignal.timeout(20000),headers:{accept:"application/json, text/html"}});
    const body=await response.text();
    const result=await accept(response,body);
    console.log((result.ok?"PASS":"FAIL")+" "+name+" HTTP="+response.status+" "+result.note);
    if(!result.ok)failures++;
  }catch(error){failures++;console.log("FAIL "+name+" "+(error instanceof Error?error.name:"Unknown"));}
}
await check("login page","/login",(r,b)=>({ok:r.status===200&&b.includes("Bot Studio"),note:"HTML renders"}));
await check("Telegram OIDC start","/api/auth/telegram/oidc/start",(r)=>({
  ok:r.status===302&&String(r.headers.get("location")).startsWith("https://oauth.telegram.org/auth?")&&r.headers.get("set-cookie")?.includes("bs_tg_oidc_state="),
  note:"redirect and OAuth state cookie"
}));
await check("buyer Mini App public catalogue","/api/miniapp?bot="+bot,(r,b)=>{
  let data={};try{data=JSON.parse(b)}catch{}
  const good=r.status===200&&data?.bot?.id===bot&&Array.isArray(data.items)&&Array.isArray(data.categories);
  return {ok:good,note:good?"published buyer catalogue loaded":"catalogue unavailable or wrong bot"};
});
if(process.env.EXPECT_PRIVILEGED==="1") await check("Privileged Supabase readiness","/api/health/auth",(r,b)=>{let data={};try{data=JSON.parse(b)}catch{}return {ok:r.status===200&&data.ok===true&&data.db==="reachable",note:data.db??"unknown"};});
await check("Supabase project consistency","/api/auth/public-config",(r,b)=>{let d={};try{d=JSON.parse(b)}catch{}const host=typeof d.url==="string"?new URL(d.url).hostname:"missing";const expected="eslbcwopolrxoptcxqhp.supabase.co";return {ok:r.status===200&&host===expected&&typeof d.key==="string"&&d.key.length>20,note:host===expected?"staging project and public key present":"CONFIG_MISMATCH observed="+host+" expected="+expected};});
await check("seller API unauthorized protection","/api/orders?bot="+bot,(r)=>({ok:r.status===401||r.status===403,note:"anonymous request blocked"}));
// Check provider initiation without user credentials or following external redirects.
const pkceChallenge = createHash("sha256").update(randomBytes(32)).digest("base64url");
const oauthProbe = new URL("https://eslbcwopolrxoptcxqhp.supabase.co/auth/v1/authorize");
oauthProbe.searchParams.set("provider", "google");
oauthProbe.searchParams.set("redirect_to", new URL("/auth/callback", base).toString());
oauthProbe.searchParams.set("code_challenge", pkceChallenge);
oauthProbe.searchParams.set("code_challenge_method", "s256");
await check("Google OAuth provider redirect (no user login)",oauthProbe.toString(),(r)=>{
  let hostname = "none";
  try { hostname = new URL(r.headers.get("location") ?? "").hostname; } catch { /* no redirect */ }
  const good = r.status >= 300 && r.status < 400 && hostname === "accounts.google.com";
  return { ok: good, note: good ? "Google OAuth redirect available" : "provider redirect unavailable" };
});

async function unauthenticatedPost(name,path,payload) {
  try {
    const response = await fetch(new URL(path,base), {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(20000),
      headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    const good = response.status === 401 || response.status === 403;
    console.log((good?"PASS":"FAIL")+" "+name+" HTTP="+response.status+" anonymous request rejected");
    if (!good) failures++;
  } catch (error) {
    console.log("FAIL "+name+" "+(error instanceof Error?error.name:"Unknown"));
    failures++;
  }
}
await unauthenticatedPost("seller bot creation protected","/api/onboarding",{
  botId:"11111111-1111-4111-8111-111111111111",
  botName:"CI unauthorized check",templateType:"store",
});
await unauthenticatedPost("Telegram BotFather linking protected","/api/channels/telegram/token",{
  botId:"11111111-1111-4111-8111-111111111111",
  action:"inspect",token:"123456789:"+ "A".repeat(46),
});
console.log("Live Staging read-only checks: "+((process.env.EXPECT_PRIVILEGED==="1"?9:8)-failures)+"/"+(process.env.EXPECT_PRIVILEGED==="1"?9:8)+" passed");
if(failures)process.exitCode=1;
