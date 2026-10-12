import { resolveAppUser,withSessionCookie } from "@/lib/auth/app-user";
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail=(error:string,status:number)=>Response.json({error},{status});
async function owner(request:Request,botId:string,initData=""){
 const identity=await resolveAppUser(request,initData);
 if("error" in identity)return {response:fail(identity.error??"Войдите в аккаунт",identity.status??401)} as const;
 const {data,error}=await identity.supabase.from("bots").select("id").eq("id",botId).eq("owner_id",identity.user.id).maybeSingle();
 if(error||!data)return {response:fail("Нет доступа к боту",403)} as const;
 return {identity} as const;
}
export async function GET(request:Request){
 const botId=new URL(request.url).searchParams.get("bot")??"";
 if(!uuid.test(botId))return fail("Укажите бота",400);
 const auth=await owner(request,botId,request.headers.get("x-telegram-init-data")??"");
 if("response" in auth)return auth.response;
 const {data,error}=await auth.identity.supabase.from("discount_campaigns").select("id,name,code,discount_type,discount_value,minimum_order_minor,starts_at,ends_at,usage_limit,usage_count,is_active,created_at").eq("bot_id",botId).order("created_at",{ascending:false}).limit(100);
 if(error)return fail("Не удалось загрузить акции",503);
 return withSessionCookie({campaigns:data??[]},200,auth.identity.setCookie);
}
export async function POST(request:Request){
 let body:Record<string,unknown>;
 try{body=await request.json() as Record<string,unknown>;}catch{return fail("Некорректный JSON",400)}
 if(!body||typeof body!=="object"||Array.isArray(body)||!uuid.test(String(body.botId??"")))return fail("Укажите бота",400);
 const botId=String(body.botId);
 const name=String(body.name??"").trim();
 const code=String(body.code??"").trim().toUpperCase();
 const discountType=String(body.discountType??"");
 const amount=Number(body.discountValue);
 const minimum=body.minimumOrderMinor==null?null:Number(body.minimumOrderMinor);
 if(name.length<2||name.length>100||code.length>32||code&&!/^[A-Z0-9_-]{3,32}$/.test(code)||!["percent","fixed","free_delivery"].includes(discountType)||!Number.isSafeInteger(amount)||amount<0||(discountType==="percent"&&amount>100)||(discountType==="fixed"&&amount>1e11)||(discountType==="free_delivery"&&amount!==0)||(minimum!==null&&(!Number.isSafeInteger(minimum)||minimum<0)))return fail("Проверьте название, промокод и размер скидки",400);
 const auth=await owner(request,botId,typeof body.initData==="string"?body.initData:"");
 if("response" in auth)return auth.response;
 const payload={bot_id:botId,name,code:code||null,discount_type:discountType,discount_value:amount,minimum_order_minor:minimum,is_active:false};
 const {data,error}=await auth.identity.supabase.from("discount_campaigns").insert(payload).select("id,name,code,discount_type,discount_value,is_active").single();
 if(error)return fail("Не удалось создать акцию",503);
 return withSessionCookie({campaign:data},201,auth.identity.setCookie);
}
export async function PATCH(request:Request){
 let body:{botId?:string;id?:string;isActive?:boolean};
 try{body=await request.json() as typeof body;}catch{return fail("Некорректные данные",400)}
 if(!uuid.test(body.botId??"")||!uuid.test(body.id??"")||typeof body.isActive!=="boolean")return fail("Некорректная акция",400);
 const auth=await owner(request,body.botId!,request.headers.get("x-telegram-init-data")??"");
 if("response" in auth)return auth.response;
 if(body.isActive){
  const {data:campaign,error:readError}=await auth.identity.supabase.from("discount_campaigns").select("id,code,discount_type,discount_value,starts_at,ends_at,usage_limit,usage_count").eq("bot_id",body.botId!).eq("id",body.id!).maybeSingle();
  if(readError||!campaign)return fail("Акция не найдена",404);
  if(!campaign.code||!Number.isSafeInteger(campaign.discount_value)||campaign.discount_value<=0&&campaign.discount_type!=="free_delivery"||campaign.discount_type==="percent"&&campaign.discount_value>100||campaign.usage_limit!=null&&campaign.usage_count>=campaign.usage_limit||campaign.ends_at&&Date.parse(campaign.ends_at)<Date.now())return fail("Акция не соответствует условиям публикации",409);
 }
 const {data,error}=await auth.identity.supabase.from("discount_campaigns").update({is_active:body.isActive}).eq("bot_id",body.botId!).eq("id",body.id!).select("id,is_active").maybeSingle();
 if(error||!data)return fail("Не удалось изменить акцию",404);
 return withSessionCookie({campaign:data},200,auth.identity.setCookie);
}
