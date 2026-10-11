import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

/**
 * Owner-only draft preview. Never changes public /api/miniapp or published
 * catalog snapshots, and never permits checkout without Telegram initData.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(error:string,status:number)=>Response.json({error},{status,headers:{"cache-control":"no-store"}});
export async function GET(request:Request) {
  const botId=new URL(request.url).searchParams.get("bot")??"";
  if(!uuid.test(botId))return fail("Выберите бота для предпросмотра.",400);
  const identity=await resolveAppUser(request,request.headers.get("x-telegram-init-data")??"");
  if("error" in identity)return fail(identity.error??"Не удалось проверить сессию.",identity.status??401);
  const {supabase,user,setCookie}=identity;
  const {data:bot,error:botError}=await supabase.from("bots")
    .select("id,name,description,logo_url,primary_color,template_type,settings")
    .eq("id",botId).eq("owner_id",user.id).maybeSingle();
  if(botError||!bot)return fail("Бот не найден или нет доступа к предпросмотру.",404);
  const itemType=bot.template_type==="delivery"?"dish":bot.template_type==="service"?"service":"product";
  const [products,categories]=await Promise.all([
    supabase.from("catalog_items")
      .select("id,name,description,image_url,price_minor,currency,category_id,ingredients,allergens,preparation_minutes,stock_quantity")
      .eq("bot_id",botId).eq("item_type",itemType).eq("is_active",true)
      .order("position",{ascending:true}).limit(200),
    supabase.from("catalog_categories")
      .select("id,name,position")
      .eq("bot_id",botId).eq("is_active",true).order("position",{ascending:true}),
  ]);
  if(products.error||categories.error)return fail("Не удалось загрузить каталог для предпросмотра.",503);
  const settings=(bot.settings??{}) as Record<string,unknown>;
  return withSessionCookie({
    bot:{id:bot.id,name:bot.name,description:bot.description??"",logoUrl:bot.logo_url,
      color:bot.primary_color,template:bot.template_type},
    items:(products.data??[]).filter(item=>item.stock_quantity===null||item.stock_quantity>0),
    categories:categories.data??[],
    design:settings.miniapp_design??null,
    delivery:settings.delivery_zone??null,
  },200,setCookie);
}
