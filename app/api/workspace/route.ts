import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

export async function GET(request: Request) {
  try {
    const initData = request.headers.get("x-telegram-init-data") ?? "";
    const identity = await resolveAppUser(request, initData);
    if ("error" in identity) return Response.json({ error: identity.error }, { status: identity.status });
    const { supabase, user, setCookie } = identity;
    const { data, error } = await supabase.from("bots").select("id,name,username,template_type,status,updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false });
    if (error) throw error;
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const bots = await Promise.all((data ?? []).map(async (bot) => {
      const [today, catalog, customers, recent] = await Promise.all([
        supabase.from("orders").select("total_minor").eq("bot_id", bot.id).gte("created_at", dayStart.toISOString()),
        supabase.from("catalog_items").select("id", { count: "exact", head: true }).eq("bot_id", bot.id).eq("is_active", true),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("bot_id", bot.id),
        supabase.from("orders").select("id,customer_name,status,total_minor,created_at").eq("bot_id", bot.id).order("created_at", { ascending: false }).limit(3),
      ]);
      return { ...bot, metrics: { ordersToday: today.data?.length ?? 0, revenueTodayMinor: today.data?.reduce((sum, order) => sum + Number(order.total_minor), 0) ?? 0, catalogItems: catalog.count ?? 0, customers: customers.count ?? 0, recentOrders: recent.data ?? [] } };
    }));
    return withSessionCookie({ bots, user: { firstName: user.first_name, telegramLinked: Boolean(user.telegram_id) } }, 200, setCookie);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Workspace unavailable" }, { status: 500 });
  }
}
