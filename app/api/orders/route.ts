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
 const {data:orders,error}=await supabase.from("orders").select("id,customer_name,customer_external_id,status,subtotal_minor,delivery_minor,total_minor,currency,fulfillment_type,delivery_address,created_at,payload").eq("bot_id",botId).order("created_at",{ascending:false}).limit(100);
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

const transitions:Record<string,string>={new:"confirmed",confirmed:"in_progress",in_progress:"ready",ready:"completed"};
export async function PATCH(request:Request){
 let input:unknown;
 try{input=await request.json();}catch{return Response.json({error:"Некорректный JSON"},{status:400});}
 if(!input||typeof input!=="object"||Array.isArray(input))return Response.json({error:"Некорректный запрос"},{status:400});
 const body=input as {botId?:unknown;orderId?:unknown;expectedStatus?:unknown;status?:unknown};
 if(typeof body.botId!=="string"||!uuid.test(body.botId)||typeof body.orderId!=="string"||!uuid.test(body.orderId)||typeof body.expectedStatus!=="string"||typeof body.status!=="string"||transitions[body.expectedStatus]!==body.status)
  return Response.json({error:"Недопустимый переход статуса"},{status:400});
 const identity=await resolveAppUser(request,request.headers.get("x-telegram-init-data")??"");
 if("error" in identity)return Response.json({error:identity.error},{status:identity.status});
 const {supabase,user,setCookie}=identity;
 const {data:bot,error:ownerError}=await supabase.from("bots").select("id").eq("id",body.botId).eq("owner_id",user.id).maybeSingle();
 if(ownerError||!bot)return Response.json({error:"Нет доступа к заказу"},{status:403});
 const {data:current,error:readError}=await supabase.from("orders").select("id,payload").eq("bot_id",body.botId).eq("id",body.orderId).maybeSingle();
 if(readError)return Response.json({error:"Не удалось проверить заказ."},{status:503});
 if(!current)return Response.json({error:"Заказ не найден."},{status:404});
 if(current.payload&&typeof current.payload==="object"&&(current.payload as Record<string,unknown>).is_demo===true)
  return Response.json({error:"Демо-заказ нельзя обрабатывать как настоящий."},{status:409});
 const {data,error}=await supabase.from("orders").update({status:body.status}).eq("bot_id",body.botId).eq("id",body.orderId).eq("status",body.expectedStatus).select("id,status").maybeSingle();
 if(error)return Response.json({error:"Не удалось изменить статус"},{status:500});
 if(!data)return Response.json({error:"Статус уже изменён другим сотрудником. Обновите список."},{status:409});
 return withSessionCookie({order:data},200,setCookie);
}
