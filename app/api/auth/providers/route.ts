import { env } from "cloudflare:workers";
export async function GET(){
 const url=env.SUPABASE_URL?.trim()??"";
 const key=env.SUPABASE_PUBLISHABLE_KEY?.trim()??"";
 const telegram=(env.TELEGRAM_LOGIN_BOT_USERNAME??env.TELEGRAM_MANAGER_USERNAME??"").replace(/^@/,"");
 const valid=/^[a-zA-Z0-9_]{5,32}$/.test(telegram);
 let googleEnabled=false;
 if(url.startsWith("https://")&&key){
  try{
   const response=await fetch(url+"/auth/v1/settings",{
    headers:{"apikey":key},signal:AbortSignal.timeout(5000),cache:"no-store"
   });
   if(response.ok){
    const settings=await response.json() as {external?:{google?:boolean}};
    googleEnabled=settings.external?.google===true;
   }
  }catch{/* Fail closed: never show an unconfigured OAuth provider as working. */}
 }
 return Response.json({
  google:googleEnabled?{supabaseUrl:url,publishableKey:key}:null,
  googleSetupRequired:!googleEnabled,
  telegram:valid?{username:telegram}:null,
 },{headers:{"cache-control":"no-store"}});
}
