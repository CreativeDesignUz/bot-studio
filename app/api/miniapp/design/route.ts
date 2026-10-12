import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

type Banner = { enabled:boolean; title:string; description:string; imageUrl:string; buttonEnabled:boolean; buttonText:string; linkType:"category"|"product"|"page"|"external"; target:string };
type Design = { layout:"food01"|"food02"; color:string; dark:boolean; themeMode:"light"|"dark"|"customer"; defaultTheme:"system"|"light"|"dark"; banner:Banner };
const textValue=(value:unknown,max:number)=>typeof value==="string"?value.trim().slice(0,max):"";
function parseBanner(value:unknown):Banner {
 const b=(value&&typeof value==="object"&&!Array.isArray(value)?value:{}) as Record<string,unknown>;
 return {enabled:b.enabled!==false,title:textValue(b.title,100),description:textValue(b.description,300),
 imageUrl:textValue(b.imageUrl,2048),buttonEnabled:b.buttonEnabled===true,buttonText:textValue(b.buttonText,50),
 linkType:["category","product","page","external"].includes(String(b.linkType))?b.linkType as Banner["linkType"]:"page",target:textValue(b.target,2048)};
}
function validBanner(b:Banner):boolean {
 if(b.imageUrl && !/^https:\/\//i.test(b.imageUrl))return false;
 if(b.buttonEnabled && (!b.buttonText||!b.target))return false;
 if(b.buttonEnabled && b.linkType==="external" && !/^https:\/\/[^\s/]+\.[^\s/]+/i.test(b.target))return false;
 if(b.buttonEnabled && b.linkType==="page" && !["catalog","cart","profile"].includes(b.target))return false;
 if(b.buttonEnabled && ["category","product"].includes(b.linkType) && !validId(b.target))return false;
 return true;
}
const hex=/^#[0-9a-f]{6}$/i;
function parse(value:unknown):Design{
 const data=(value&&typeof value==="object"?value:{}) as Partial<Design>;
 return {layout:data.layout==="food02"?"food02":"food01",color:typeof data.color==="string"&&hex.test(data.color)?data.color:"#E65D35",dark:data.dark===true,themeMode:["light","dark","customer"].includes(String(data.themeMode))?data.themeMode as Design["themeMode"]:(data.dark===true?"dark":"light"),defaultTheme:["system","light","dark"].includes(String(data.defaultTheme))?data.defaultTheme as Design["defaultTheme"]:"system",banner:parseBanner(data.banner)};
}
function validId(id:string){return /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id)}
async function owned(request:Request,id:string,initData:string){
 const identity=await resolveAppUser(request,initData);
 if("error" in identity)return {error:identity.error,status:identity.status} as const;
 const {data,error}=await identity.supabase.from("bots").select("id,settings,template_type").eq("id",id).eq("owner_id",identity.user.id).maybeSingle();
 if(error||!data)return {error:"Бот не найден или нет прав доступа.",status:404} as const;
 return {identity,bot:data} as const;
}
export async function GET(request:Request){
 const botId=new URL(request.url).searchParams.get("bot")??"";
 if(!validId(botId))return Response.json({error:"Укажите бота."},{status:400});
 const result=await owned(request,botId,request.headers.get("x-telegram-init-data")??"");
 if("error" in result)return Response.json({error:result.error},{status:result.status});
 const settings=(result.bot.settings??{}) as Record<string,unknown>;
 return withSessionCookie({design:parse(settings.miniapp_design),templateType:result.bot.template_type},200,result.identity.setCookie);
}
export async function POST(request:Request){
 let body:{botId?:string;initData?:string;layout?:unknown;color?:unknown;dark?:unknown;themeMode?:unknown;defaultTheme?:unknown;banner?:unknown};
 try{body=await request.json()}catch{return Response.json({error:"Неверные данные."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body)||!validId(body.botId??""))return Response.json({error:"Укажите бота."},{status:400});
 if(!["food01","food02"].includes(String(body.layout))||typeof body.color!=="string"||!hex.test(body.color)||typeof body.dark!=="boolean")return Response.json({error:"Проверьте тему, цвет и режим."},{status:400});
 const result=await owned(request,body.botId!,body.initData??"");
 if("error" in result)return Response.json({error:result.error},{status:result.status});
 if(result.bot.template_type!=="delivery")return Response.json({error:"Food-темы доступны только для доставки еды."},{status:400});
 const settings=(result.bot.settings??{}) as Record<string,unknown>;
 const old=parse(settings.miniapp_design);
 const themeMode=body.themeMode===undefined?(body.dark?"dark":"light"):body.themeMode;
 const defaultTheme=body.defaultTheme===undefined?"system":body.defaultTheme;
 if(!["light","dark","customer"].includes(String(themeMode))||!["system","light","dark"].includes(String(defaultTheme)))return Response.json({error:"Некорректный режим темы."},{status:400});
 const banner=body.banner===undefined?old.banner:parseBanner(body.banner);
 if(!validBanner(banner))return Response.json({error:"Проверьте баннер и ссылку кнопки."},{status:400});
 const design:Design={layout:body.layout as Design["layout"],color:body.color,dark:themeMode==="dark",themeMode:themeMode as Design["themeMode"],defaultTheme:defaultTheme as Design["defaultTheme"],banner};
 const {data,error}=await result.identity.supabase.from("bots").update({settings:{...settings,miniapp_design:design}}).eq("id",body.botId!).eq("owner_id",result.identity.user.id).select("id").maybeSingle();
 if(error||!data)return Response.json({error:"Не удалось сохранить оформление."},{status:500});
 return withSessionCookie({ok:true,design},200,result.identity.setCookie);
}
