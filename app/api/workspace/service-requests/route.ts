import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

const valid=(v:unknown)=>typeof v==="string" && /^[0-9a-f-]{36}$/i.test(v);
async function owner(request:Request,botId:string,initData:string){
  const identity=await resolveAppUser(request,initData);
  if("error" in identity)return null;
  const {supabase,user,setCookie}=identity;
  const {data:bot}=await supabase.from("bots").select("id,template_type").eq("id",botId).eq("owner_id",user.id).maybeSingle();
  return bot?.template_type==="service"?{supabase,setCookie}:null;
}
export async function GET(request:Request){
  const url=new URL(request.url),botId=url.searchParams.get("bot")??"";
  if(!valid(botId))return Response.json({error:"Укажите бота."},{status:400});
  const auth=await owner(request,botId,request.headers.get("x-telegram-init-data")??"");
  if(!auth)return Response.json({error:"Нет доступа."},{status:403});
  const {data,error}=await auth.supabase.from("orders")
    .select("id,customer_name,status,payment_status,total_minor,currency,created_at,payload,order_items(item_name)")
    .eq("bot_id",botId).contains("payload",{source:"service_request"})
    .order("created_at",{ascending:false}).limit(100);
  return error?Response.json({error:"Ошибка загрузки."},{status:503}):withSessionCookie({requests:data??[]},200,auth.setCookie);
}
export async function POST(request:Request){
  let p:{botId?:string;requestId?:string;status?:string;initData?:string};
  try{p=await request.json() as typeof p}catch{return Response.json({error:"Некорректный запрос."},{status:400})}
  if(!valid(p.botId)||!valid(p.requestId))return Response.json({error:"Проверьте данные."},{status:400});
  const auth=await owner(request,p.botId!,p.initData??"");
  if(!auth)return Response.json({error:"Нет доступа."},{status:403});
  const {data:existing}=await auth.supabase.from("orders").select("id,status").eq("id",p.requestId!).eq("bot_id",p.botId!).contains("payload",{source:"service_request"}).maybeSingle();
  if(!existing)return Response.json({error:"Заявка не найдена."},{status:404});
  const allowed:Record<string,string[]>={new:["confirmed","cancelled"],confirmed:["in_progress","cancelled"],in_progress:["completed","cancelled"]};
  if(!allowed[existing.status]?.includes(p.status??""))return Response.json({error:"Недопустимый переход."},{status:409});
  const {data,error}=await auth.supabase.from("orders").update({status:p.status}).eq("id",p.requestId!).eq("bot_id",p.botId!).eq("status",existing.status).select("id,status").maybeSingle();
  return error||!data?Response.json({error:"Статус не обновлён."},{status:409}):withSessionCookie({request:data},200,auth.setCookie);
}
