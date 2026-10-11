import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(request:Request){
 const botId=new URL(request.url).searchParams.get("bot")??"";
 if(!uuid.test(botId))return Response.json({error:"Некорректный бот"},{status:400});
 const identity=await resolveAppUser(request,request.headers.get("x-telegram-init-data")??"");
 if("error" in identity)return Response.json({error:identity.error},{status:identity.status});
 const {supabase,user,setCookie}=identity;
 const {data:bot,error:ownershipError}=await supabase.from("bots").select("id").eq("id",botId).eq("owner_id",user.id).maybeSingle();
 if(ownershipError||!bot)return Response.json({error:"Нет доступа к заказам"},{status:403});
 const {data:orders,error}=await supabase.from("orders").select("id,customer_name,customer_external_id,status,subtotal_minor,delivery_minor,total_minor,currency,fulfillment_type,delivery_address,created_at").eq("bot_id",botId).order("created_at",{ascending:false}).limit(100);
 if(error)return Response.json({error:"Не удалось загрузить заказы"},{status:500});
 const ids=(orders??[]).map(order=>order.id);
 let items:Array<{order_id:string;item_name:string;quantity:number;unit_price_minor:number}>=[];
 if(ids.length){
  const result=await supabase.from("order_items").select("order_id,item_name,quantity,unit_price_minor").in("order_id",ids);
  if(result.error)return Response.json({error:"Не удалось загрузить состав заказа"},{status:500});
  items=result.data??[];
 }
 return withSessionCookie({orders:(orders??[]).map(order=>({...order,items:items.filter(item=>item.order_id===order.id)}))},200,setCookie);
}
