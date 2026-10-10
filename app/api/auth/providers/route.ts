import { env } from "cloudflare:workers";
export async function GET(){
 const url=env.SUPABASE_URL?.trim()??"";
 const key=env.SUPABASE_PUBLISHABLE_KEY?.trim()??"";
 const telegram=(env.TELEGRAM_MANAGER_USERNAME??"").replace(/^@/,"");
 const valid=/^[a-zA-Z0-9_]{5,32}$/.test(telegram);
 return Response.json({
  google: url.startsWith("https://")&&!!key?{supabaseUrl:url,publishableKey:key}:null,
  telegram:valid?{username:telegram}:null,
 },{headers:{"cache-control":"no-store"}});
}
