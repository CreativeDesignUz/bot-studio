import {resolveAppUser,withSessionCookie} from "@/lib/auth/app-user";

const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const types:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
const maxBytes=5*1024*1024;

export async function POST(request:Request){
 let form:FormData;
 try{form=await request.formData()}catch{return Response.json({error:"Не удалось прочитать изображение."},{status:400})}
 const botId=String(form.get("botId")??"");
 const initData=String(form.get("initData")??"");
 const image=form.get("image");
 if(!idPattern.test(botId))return Response.json({error:"Некорректный бот."},{status:400});
 if(!(image instanceof File)||!types[image.type]||image.size===0||image.size>maxBytes)
  return Response.json({error:"Загрузите JPG, PNG или WebP до 5 МБ."},{status:400});
 // Validate signature/MIME bytes, not just browser-supplied file.type.
 const bytes=new Uint8Array(await image.arrayBuffer());
 const jpg=bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x);
 const webp=bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
 if(!(image.type==="image/jpeg"&&jpg||image.type==="image/png"&&png||image.type==="image/webp"&&webp))
  return Response.json({error:"Файл не соответствует формату изображения."},{status:400});
 const identity=await resolveAppUser(request,initData);
 if("error" in identity)return Response.json({error:identity.error},{status:identity.status});
 const {supabase,user,setCookie}=identity;
 const {data:bot,error:ownershipError}=await supabase.from("bots").select("id,template_type").eq("id",botId).eq("owner_id",user.id).maybeSingle();
 if(ownershipError)return Response.json({error:"Не удалось проверить владельца бота."},{status:500});
 if(!bot)return Response.json({error:"Нет доступа к боту."},{status:404});
 if(!["delivery","store","service"].includes(bot.template_type))
  return Response.json({error:"Фото для этого шаблона пока не поддерживается."},{status:400});
 const key=`${user.id}/${botId}/catalog/${crypto.randomUUID()}.${types[image.type]}`;
 const uploaded=await supabase.storage.from("bot-assets").upload(key,bytes,{contentType:image.type,upsert:false,cacheControl:"3600"});
 if(uploaded.error)return Response.json({error:"Не удалось загрузить фото. Повторите попытку."},{status:500});
 const imageUrl=supabase.storage.from("bot-assets").getPublicUrl(key).data.publicUrl;
 return withSessionCookie({imageUrl},200,setCookie);
}
