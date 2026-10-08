import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

export async function GET(request: Request) {
  try {
    const initData = request.headers.get("x-telegram-init-data") ?? "";
    const identity = await resolveAppUser(request, initData);
    if ("error" in identity) return Response.json({ error: identity.error }, { status: identity.status });
    const { supabase, user, setCookie } = identity;
    const { data, error } = await supabase.from("bots").select("id,name,username,template_type,status,updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false });
    if (error) throw error;
    return withSessionCookie({ bots: data ?? [], user: { firstName: user.first_name, telegramLinked: Boolean(user.telegram_id) } }, 200, setCookie);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Workspace unavailable" }, { status: 500 });
  }
}
