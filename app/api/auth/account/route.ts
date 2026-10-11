import { getSupabaseServer } from "@/lib/supabase/server";
import { clearAuthCookie,readAuthUserId } from "@/lib/auth/account-session";

type LoginInput={provider?:string;accessToken?:string;telegram?:Record<string,unknown>};
import {createAccountSession} from "@/lib/auth/account-service";
function fail(error:string,status:number){return Response.json({error},{status})}
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
