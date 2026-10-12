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
await check("Privileged Supabase readiness","/api/health/auth",(r,b)=>{let data={};try{data=JSON.parse(b)}catch{}return {ok:r.status===200&&data.ok===true&&data.db==="reachable",note:data.db??"unknown"};});
await check("Supabase project consistency","/api/auth/public-config",(r,b)=>{let d={};try{d=JSON.parse(b)}catch{}const host=typeof d.url==="string"?new URL(d.url).hostname:"missing";const expected="eslbcwopolrxoptcxqhp.supabase.co";return {ok:r.status===200&&host===expected&&typeof d.key==="string"&&d.key.length>20,note:host===expected?"staging project and public key present":"CONFIG_MISMATCH observed="+host+" expected="+expected};});
await check("seller API unauthorized protection","/api/orders?bot="+bot,(r)=>({ok:r.status===401||r.status===403,note:"anonymous request blocked"}));
console.log("Live Staging read-only checks: "+(6-failures)+"/6 passed");
if(failures)process.exitCode=1;
