import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.rpc("bot_studio_health");
    if (error) throw error;
    return Response.json({ connected: true, database: "supabase", ...data });
  } catch (error) {
    return Response.json(
      { connected: false, database: "supabase", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 503 },
    );
  }
}
