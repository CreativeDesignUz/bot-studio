import { env } from "cloudflare:workers";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const headers = {"cache-control":"no-store"};
  const configured = Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_SECRET_KEY);
  if (!configured) return Response.json({ok:false,db:"configuration_missing"},{status:503,headers});
  try {
    const db = getSupabaseServer({privileged:true});
    const {error} = await db.from("app_users").select("id").limit(0);
    if (error) {
      console.error("Staging auth database probe failed",{code:error.code??"unknown",status:error.details?"db_error":"db_error"});
      return Response.json({ok:false,db:"unavailable"},{status:503,headers});
    }
    return Response.json({ok:true,db:"reachable"},{headers});
  } catch(e) {
    console.error("Staging auth database probe failed",{category:e instanceof Error?e.name:"unknown"});
    return Response.json({ok:false,db:"unavailable"},{status:503,headers});
  }
}
