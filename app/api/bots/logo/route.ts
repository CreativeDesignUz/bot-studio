import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  const form = await request.formData();
  const botId = String(form.get("botId") ?? "");
  const initData = String(form.get("initData") ?? "");
  const logo = form.get("logo");
  if (!botId || !(logo instanceof File) || !allowedTypes.has(logo.type) || logo.size > 2 * 1024 * 1024) {
    return Response.json({ error: "Нужно изображение PNG, JPG или WebP до 2 МБ" }, { status: 400 });
  }

  const identity = await resolveAppUser(request, initData);
  if ("error" in identity) return Response.json({ error: identity.error }, { status: identity.status });
  const { supabase, user, setCookie } = identity;
  const owned = await supabase.from("bots").select("id").eq("id", botId).eq("owner_id", user.id).maybeSingle();
  if (!owned.data) return Response.json({ error: "Bot not found" }, { status: 404 });

  const extension = logo.type === "image/png" ? "png" : logo.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${botId}/logo-${Date.now()}.${extension}`;
  const uploaded = await supabase.storage.from("bot-assets").upload(path, await logo.arrayBuffer(), { contentType: logo.type, upsert: true });
  if (uploaded.error) return Response.json({ error: uploaded.error.message }, { status: 500 });
  const logoUrl = supabase.storage.from("bot-assets").getPublicUrl(path).data.publicUrl;
  const updated = await supabase.from("bots").update({ logo_url: logoUrl }).eq("id", botId).eq("owner_id", user.id);
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 500 });
  return withSessionCookie({ logoUrl }, 200, setCookie);
}
