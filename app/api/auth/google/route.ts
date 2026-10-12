import { getSupabaseServer } from "@/lib/supabase/server";
export async function GET(request:Request){
  const origin=new URL(request.url).origin;
  const supabase=getSupabaseServer();
  const {data,error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:origin+"/auth/callback",skipBrowserRedirect:true}});
  if(error||!data.url)return Response.json({error:"Google login unavailable"},{status:503});
  return Response.redirect(data.url,302);
}
