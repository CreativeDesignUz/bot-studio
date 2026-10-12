import {getSupabaseServer} from "@/lib/supabase/server";
import {resolveAppUser,withSessionCookie} from "@/lib/auth/app-user";
const isUuid=(id:string)=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
const jsonError=(message:string,status:number)=>Response.json({error:message},{status});
export async function GET(request: Request) {
  const url=new URL(request.url);
  const botId = url.searchParams.get("bot") ?? "";
  if (!isUuid(botId)) return jsonError("Некорректный бот", 400);
  try {
    if(url.searchParams.get("preview")==="1"){
      const identity=await resolveAppUser(request,request.headers.get("x-telegram-init-data")??"");
      if("error" in identity)return jsonError(identity.error??"Требуется авторизация",identity.status??401);
      const {data:bot,error:botError}=await identity.supabase.from("bots")
        .select("id,name,description,logo_url,primary_color,template_type,settings")
        .eq("id",botId).eq("owner_id",identity.user.id).maybeSingle();
      if(botError||!bot)return jsonError("Бот не найден или нет прав доступа",404);
      const [{data:items,error:itemError},{data:categories,error:categoryError}]=await Promise.all([
        identity.supabase.from("catalog_items").select("id,name,description,price_minor,currency,image_url,category_id,ingredients,allergens,preparation_minutes,stock_quantity").eq("bot_id",botId).eq("is_active",true).order("position",{ascending:true}),
        identity.supabase.from("catalog_categories").select("id,name,position").eq("bot_id",botId).eq("is_active",true).order("position",{ascending:true}),
      ]);
      if(itemError||categoryError)return jsonError("Не удалось загрузить черновик каталога",503);
      const settings=(bot.settings??{}) as Record<string,unknown>;
      return withSessionCookie({
        bot:{id:bot.id,name:bot.name,description:bot.description,logoUrl:bot.logo_url,color:bot.primary_color,template:bot.template_type},
        items:(items??[]).filter(item=>(item.stock_quantity??1)>0),categories:categories??[],design:settings.miniapp_design??null,delivery:settings.delivery_zone??null,preview:true,
      },200,identity.setCookie);
    }
    const supabase = getSupabaseServer({ privileged: true });
    const { data: bot, error } = await supabase.from("bots")
      .select("id,name,description,logo_url,primary_color,template_type,status,publish_status,published_snapshot")
      .eq("id", botId).single();
    if (error || !bot || bot.status !== "active" || bot.publish_status !== "published")
      return jsonError("Магазин ещё не опубликован", 404);
    const published = (bot.published_snapshot ?? {}) as Record<string, unknown>;
    const catalog = (published.catalog ?? {}) as Record<string, unknown>;
    if (!Array.isArray(catalog.items) || !Array.isArray(catalog.categories))
      return jsonError("Каталог ожидает публикации или обновления базы данных", 503);
    // Publication freezes content and price, while inventory availability is live.
    const publishedItems = catalog.items as Array<{id:string;[key:string]:unknown}>;
    const ids = publishedItems.map(item=>item.id);
    let items = publishedItems;
    if(ids.length){
      const {data:inventory,error:inventoryError}=await supabase.from("catalog_items")
        .select("id,stock_quantity").eq("bot_id",botId).in("id",ids);
      if(inventoryError)return jsonError("Временно недоступна проверка остатков",503);
      const stocks=new Map((inventory??[]).map(row=>[row.id,row.stock_quantity]));
      items=publishedItems.filter(item=>stocks.has(item.id)&&((stocks.get(item.id)??1)>0));
    }
    const categories = catalog.categories;
    // Buyer-visible theme comes exclusively from the last successful publication,
    // not the seller's still-editable draft settings.
    const publishedSettings = (published.settings ?? {}) as Record<string, unknown>;
    const designSettings = publishedSettings.miniapp_design;
    const deliverySettings = publishedSettings.delivery_zone;
    return Response.json({
      bot: {
        id: bot.id, name: published.name ?? bot.name, description: published.description ?? bot.description,
        logoUrl: published.logo_url ?? bot.logo_url, color: published.primary_color ?? bot.primary_color,
        template: published.template_type ?? bot.template_type,
      },
      items: items ?? [], categories: categories??[], design:designSettings??null, delivery:deliverySettings??null,
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return jsonError("Временная ошибка загрузки каталога", 503);
  }
}

