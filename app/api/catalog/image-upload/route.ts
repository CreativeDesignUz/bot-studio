import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";
const allowed=new Map([["image/jpeg","jpg"],["image/png","png"],["image/webp","webp"]]);
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export async function POST(request:Request){
  if(Number(request.headers.get("content-length")??0)>4*1024*1024)return Response.json({error:"Файл слишком большой"},{status:413});
  const identity=await resolveAppUser(request,request.headers.get("x-telegram-init-data")??"");
  if("error" in identity)return Response.json({error:identity.error},{status:identity.status});
  let form:FormData;
  try{form=await request.formData();}catch{return Response.json({error:"Неверный файл"},{status:400});}
  const botId=String(form.get("botId")??"");
  const photo=form.get("photo");
  if(!uuid.test(botId)||!(photo instanceof File)||!allowed.has(photo.type)||photo.size===0||photo.size>3*1024*1024)return Response.json({error:"Загрузите JPG, PNG или WebP до 3 МБ"},{status:400});
  const {supabase,user,setCookie}=identity;
  const {data:bot,error:ownershipError}=await supabase.from("bots").select("id").eq("id",botId).eq("owner_id",user.id).maybeSingle();
  if(ownershipError||!bot)return Response.json({error:"Нет доступа к боту"},{status:403});
  const magic=new Uint8Array(await photo.slice(0,16).arrayBuffer());
  const jpeg=magic[0]===0xff&&magic[1]===0xd8&&magic[2]===0xff;
  const png=magic.slice(0,8).join(",")==="137,80,78,71,13,10,26,10";
  const webp=String.fromCharCode(...magic.slice(0,4))==="RIFF"&&String.fromCharCode(...magic.slice(8,12))==="WEBP";
  if(!(photo.type==="image/jpeg"&&jpeg||photo.type==="image/png"&&png||photo.type==="image/webp"&&webp))return Response.json({error:"Содержимое файла не соответствует изображению"},{status:400});
  const path=`${user.id}/${botId}/catalog/${crypto.randomUUID()}.${allowed.get(photo.type)}`;
  const {error}=await supabase.storage.from("bot-assets").upload(path,await photo.arrayBuffer(),{contentType:photo.type,upsert:false});
  if(error)return Response.json({error:"Не удалось загрузить фото. Проверьте Storage."},{status:503});
  const imageUrl=supabase.storage.from("bot-assets").getPublicUrl(path).data.publicUrl;
  return withSessionCookie({imageUrl},200,setCookie);
}
