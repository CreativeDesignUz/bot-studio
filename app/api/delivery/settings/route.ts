import {resolveAppUser,withSessionCookie} from "@/lib/auth/app-user";

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type DeliveryZone={enabled:boolean;centerLat:number;centerLng:number;radiusKm:number;feeMinor:number};
export const defaultDeliveryZone:DeliveryZone={enabled:false,centerLat:41.2995,centerLng:69.2401,radiusKm:5,feeMinor:0};
function valid(zone:DeliveryZone){return typeof zone.enabled==="boolean"&&Number.isFinite(zone.centerLat)&&Math.abs(zone.centerLat)<=85&&Number.isFinite(zone.centerLng)&&Math.abs(zone.centerLng)<=180&&Number.isFinite(zone.radiusKm)&&zone.radiusKm>=0.1&&zone.radiusKm<=100&&Number.isSafeInteger(zone.feeMinor)&&zone.feeMinor>=0&&zone.feeMinor<=100000000;}
export function parseDeliveryZone(value:unknown):DeliveryZone|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const z=value as Record<string,unknown>;
 const result={enabled:z.enabled,centerLat:z.centerLat,centerLng:z.centerLng,radiusKm:z.radiusKm,feeMinor:z.feeMinor} as DeliveryZone;
 return valid(result)?result:null;
}
async function owner(request:Request,botId:string,initData:string){
 const identity=await resolveAppUser(request,initData);
 if("error" in identity)return {error:identity.error,status:identity.status} as const;
 const {data,error}=await identity.supabase.from("bots").select("id,template_type,settings").eq("id",botId).eq("owner_id",identity.user.id).maybeSingle();
 if(error||!data)return {error:"Нет доступа к настройкам доставки",status:403} as const;
 if(!["store","delivery"].includes(data.template_type))return {error:"Доставка доступна для магазинов и ресторанов",status:400} as const;
 return {identity,bot:data} as const;
}
export async function GET(request:Request){
 const botId=new URL(request.url).searchParams.get("bot")??"";
 if(!uuid.test(botId))return Response.json({error:"Некорректный бот"},{status:400});
 const result=await owner(request,botId,request.headers.get("x-telegram-init-data")??"");
 if("error" in result)return Response.json({error:result.error},{status:result.status});
 const settings=(result.bot.settings??{}) as Record<string,unknown>;
 return withSessionCookie({delivery:parseDeliveryZone(settings.delivery_zone)??defaultDeliveryZone},200,result.identity.setCookie);
}
export async function POST(request:Request){
 let body:unknown;try{body=await request.json();}catch{return Response.json({error:"Некорректный JSON"},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return Response.json({error:"Некорректный запрос"},{status:400});
 const input=body as {botId?:unknown;initData?:unknown;delivery?:unknown};
 if(typeof input.botId!=="string"||!uuid.test(input.botId))return Response.json({error:"Некорректный бот"},{status:400});
 const zone=parseDeliveryZone(input.delivery);
 if(!zone)return Response.json({error:"Проверьте центр зоны, радиус и стоимость доставки"},{status:400});
 const result=await owner(request,input.botId,typeof input.initData==="string"?input.initData:"");
 if("error" in result)return Response.json({error:result.error},{status:result.status});
 const settings=(result.bot.settings??{}) as Record<string,unknown>;
 const {data,error}=await result.identity.supabase.from("bots").update({settings:{...settings,delivery_zone:zone}}).eq("id",input.botId).eq("owner_id",result.identity.user.id).select("id").maybeSingle();
 if(error||!data)return Response.json({error:"Не удалось сохранить зону доставки"},{status:500});
 return withSessionCookie({ok:true,delivery:zone},200,result.identity.setCookie);
}
