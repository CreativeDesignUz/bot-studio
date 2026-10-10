import { telegramCall } from "@/lib/channels/telegram-api";

type BotProfile={bio:string;avatarUrl:string|null;supabaseUrl:string};

export async function syncTelegramBotProfile(token:string,profile:BotProfile){
  await telegramCall(token,"setMyShortDescription",{short_description:profile.bio.slice(0,120)});
  if(!profile.avatarUrl)return;
  const candidate=new URL(profile.avatarUrl);
  const base=new URL(profile.supabaseUrl);
  if(candidate.protocol!=="https:"||candidate.origin!==base.origin||!candidate.pathname.startsWith("/storage/v1/object/public/bot-assets/"))
    throw new Error("Invalid avatar storage URL");
  const image=await fetch(candidate.toString());
  if(!image.ok)throw new Error("Avatar download failed");
  const mime=image.headers.get("content-type")?.split(";")[0];
  if(!["image/jpeg","image/png","image/webp"].includes(mime??""))throw new Error("Unsupported avatar content type");
  const file=await image.arrayBuffer();
  if(!file.byteLength||file.byteLength>2*1024*1024)throw new Error("Avatar image size invalid");
  const form=new FormData();
  form.set("photo",JSON.stringify({type:"static",photo:"attach://avatar"}));
  form.set("avatar",new Blob([file],{type:mime??"image/jpeg"}),"avatar.jpg");
  const result=await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`,{method:"POST",body:form});
  const parsed=await result.json() as {ok?:boolean};
  if(!result.ok||!parsed.ok)throw new Error("Telegram avatar update failed");
}
