import {getSupabaseServer} from "@/lib/supabase/server";
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export async function GET(request:Request){
 const botId=new URL(request.url).searchParams.get("bot")??"";
 if(!uuid.test(botId))return Response.json({error:"Не указан магазин"},{status:400});
 try{
  const db=getSupabaseServer({privileged:true});
  const {data:bot,error}=await db.from("bots").select("id,name,description,logo_url,primary_color,template_type,status,settings").eq("id",botId).eq("status","active").maybeSingle();
  if(error||!bot)return Response.json({error:"Магазин не найден или не опубликован"},{status:404});
  const [{data:items,error:ie},{data:categories,error:ce}]=await Promise.all([
   db.from("catalog_items").select("id,name,description,image_url,price_minor,currency,category_id,ingredients,allergens,preparation_minutes,stock_quantity").eq("bot_id",botId).eq("is_active",true).order("position",{ascending:true}).limit(250),
   db.from("catalog_categories").select("id,name,position").eq("bot_id",botId).eq("is_active",true).order("position",{ascending:true}).limit(100),
  ]);
  if(ie||ce)return Response.json({error:"Не удалось загрузить каталог"},{status:503});
  const settings=bot.settings&&typeof bot.settings==="object"?bot.settings as Record<string,unknown>:{};
  return Response.json({bot:{id:bot.id,name:bot.name,description:bot.description,logoUrl:bot.logo_url,color:bot.primary_color,template:bot.template_type},items:(items??[]).filter(item=>item.stock_quantity==null||item.stock_quantity>0),categories:categories??[],design:settings.miniapp_design??null,delivery:settings.delivery_zone??null},{headers:{"cache-control":"no-store"}});
 }catch{return Response.json({error:"Каталог временно недоступен"},{status:503});}
}
