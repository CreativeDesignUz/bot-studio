"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FigmaTelegramPreview from "./figma-telegram-preview";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, Check, ChevronRight, Eye, GripVertical, LoaderCircle, Plus, Save, Send, Trash2, MessageCircle, Smartphone, ExternalLink, KeyRound, ShieldCheck, Unplug } from "lucide-react";

type ActionButton={id:string;label:string;action:"home"|"url"|"reply";url?:string;replyText?:string;nextButtons?:ActionButton[]};
type PublishState="idle"|"validating"|"saving"|"publishing"|"published"|"connection"|"error";
type LoadState="loading"|"ready"|"error";
type DraftResponse={bot?:{name:string;description:string;primary_color:string;logo_url?:string|null;settings?:{home_buttons?:ActionButton[];telegram_bio?:string;welcome_message?:string}};error?:string};
type ErrorResponse={error?:string};
type TelegramConnection={status:string;username?:string|null;mode?:"botfather"|"manager"}|null;
type InspectedBot={credentialId:string;bot:{id:number;name:string;username:string}};

export default function BotBuilder(){
 const searchParams=useSearchParams();
 const botId=searchParams.get("bot");
 const [name,setName]=useState(""),[description,setDescription]=useState(""),[color,setColor]=useState("#6541F5");
 const [buttons,setButtons]=useState<ActionButton[]>([]);
 const [bio,setBio]=useState(""),[welcome,setWelcome]=useState(""),[avatar,setAvatar]=useState<string|null>(null),[avatarBusy,setAvatarBusy]=useState(false);
 const [activeSection,setActiveSection]=useState<"message"|"buttons"|"miniapp"|"publish">("message");
 const [previewMode,setPreviewMode]=useState<"telegram"|"miniapp">("telegram");
 const [figmaPreview,setFigmaPreview]=useState<"profile"|"chat">("chat");
 const [connectUrl,setConnectUrl]=useState<string|null>(null);
 const [dirty,setDirty]=useState(false),[saved,setSaved]=useState(true),[publishState,setPublishState]=useState<PublishState>("idle");
 const [loadState,setLoadState]=useState<LoadState>("loading"),[loadError,setLoadError]=useState("");
 const [connection,setConnection]=useState<TelegramConnection>(null),[telegramToken,setTelegramToken]=useState(""),[inspectedBot,setInspectedBot]=useState<InspectedBot|null>(null);
 const [connectionState,setConnectionState]=useState<"idle"|"checking"|"connecting"|"disconnecting">("idle"),[connectionError,setConnectionError]=useState("");
 useEffect(()=>{
  const tg=(window as typeof window&{Telegram?:{WebApp?:{ready?:()=>void;expand?:()=>void;initData?:string}}}).Telegram?.WebApp;
  tg?.ready?.();tg?.expand?.();
  const controller=new AbortController();
  async function loadBot(){
   if(!botId){setLoadError("Не указан бот для редактирования.");setLoadState("error");return}
   setLoadState("loading");setLoadError("");
   try{
    const response=await fetch(`/api/bots/draft?bot=${encodeURIComponent(botId)}`,{headers:{"x-telegram-init-data":tg?.initData??""},signal:controller.signal});
    const result=await response.json() as DraftResponse;
    if(!response.ok||!result.bot)throw new Error(result.error||"Не удалось загрузить бота.");
    setName(result.bot.name);setDescription(result.bot.description);setBio(result.bot.settings?.telegram_bio??"");setWelcome(result.bot.settings?.welcome_message??result.bot.description);setAvatar(result.bot.logo_url??null);setColor(result.bot.primary_color);setButtons((result.bot.settings?.home_buttons??[]).map(button=>({...button,id:button.id??crypto.randomUUID(),action:button.action==="url"?"url":button.action==="reply"?"reply":"home",nextButtons:button.nextButtons?.map(next=>({...next,id:next.id??crypto.randomUUID()}))})));
    setDirty(false);setSaved(true);setLoadState("ready");
    const connectionResponse=await fetch(`/api/channels/telegram/token?bot=${encodeURIComponent(botId)}`,{headers:{"x-telegram-init-data":tg?.initData??""},signal:controller.signal});
    if(connectionResponse.ok){const connectionResult=await connectionResponse.json() as {connection?:TelegramConnection};setConnection(connectionResult.connection??null)}
   }catch(error){
    if(controller.signal.aborted)return;
    setLoadError(error instanceof Error?error.message:"Не удалось загрузить бота.");setLoadState("error");
   }
  }
  void loadBot();
  return()=>controller.abort();
 },[botId]);
 function change(fn:()=>void){fn();setDirty(true);setSaved(false);if(publishState==="published")setPublishState("idle")}
 async function save(){
  if(!botId||loadState!=="ready"){setPublishState("error");return false}
  setLoadError("");setPublishState("saving");
  const telegram=(window as typeof window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp;
  try{
   const response=await fetch("/api/bots/draft",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({initData:telegram?.initData,botId,name,description,bio,welcome,color,buttons})});
   const result=await response.json() as ErrorResponse;
   if(!response.ok)throw new Error(result.error||"Не удалось сохранить изменения.");
   setDirty(false);setSaved(true);setPublishState("idle");return true;
  }catch(error){setLoadError(error instanceof Error?error.message:"Не удалось сохранить изменения.");setPublishState("error");return false}
 }
 async function uploadAvatar(file:File){
  if(!botId)return;
  if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>2*1024*1024){setLoadError("Загрузите квадратное изображение PNG, JPG или WebP размером до 2 МБ.");return}
  setAvatarBusy(true);setLoadError("");
  try{
   const form=new FormData();form.append("botId",botId);form.append("logo",file);form.append("initData",telegramInitData()??"");
   const response=await fetch("/api/bots/logo",{method:"POST",body:form});
   const result=await response.json() as {logoUrl?:string;error?:string};
   if(!response.ok||!result.logoUrl)throw new Error(result.error??"Не удалось загрузить аватар.");
   setAvatar(result.logoUrl);setSaved(false);setDirty(true);if(publishState==="published")setPublishState("idle");
  }catch(e){setLoadError(e instanceof Error?e.message:"Ошибка загрузки аватара.");}
  finally{setAvatarBusy(false)}
 }
 async function publish(){
  if(dirty&&!(await save()))return;
  setLoadError("");setPublishState("validating");await new Promise(r=>setTimeout(r,500));setPublishState("publishing");
  const telegram=(window as typeof window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp;
  try{
   const response=await fetch("/api/publish",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({initData:telegram?.initData,botId,name,description,bio,welcome,color,buttons})});
   const result=await response.json() as {status?:string;requiresTelegramConnection?:boolean;connectUrl?:string;error?:string};
   if(result.requiresTelegramConnection&&result.connectUrl){setConnectUrl(result.connectUrl);setPublishState("connection");return}
   if(!response.ok||result.status!=="published")throw new Error(result.error||"Публикация не завершена. Повторите попытку.");
   setPublishState("published");
  }catch(error){setLoadError(error instanceof Error?error.message:"Не удалось опубликовать бота.");setActiveSection("publish");setPublishState("error")}
 }
 const telegramInitData=()=>(window as typeof window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData;
 async function inspectTelegramToken(){
  if(!botId||!telegramToken.trim())return;setConnectionError("");setConnectionState("checking");setInspectedBot(null);
  try{const response=await fetch("/api/channels/telegram/token",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"inspect",botId,token:telegramToken.trim(),initData:telegramInitData()})});const result=await response.json() as {credentialId?:string;alreadyConnected?:boolean;bot?:{id:number;name:string;username:string};error?:string};if(!response.ok||!result.bot)throw new Error(result.error||"Не удалось проверить токен");setTelegramToken("");if(result.alreadyConnected){setConnection({status:"connected",username:result.bot.username,mode:"botfather"});return}if(!result.credentialId)throw new Error("Не удалось подготовить подключение");setInspectedBot({credentialId:result.credentialId,bot:result.bot})}catch(error){setConnectionError(error instanceof Error?error.message:"Не удалось проверить токен")}finally{setConnectionState("idle")}
 }
 async function confirmTelegramConnection(){
  if(!botId||!inspectedBot)return;setConnectionError("");setConnectionState("connecting");
  try{const response=await fetch("/api/channels/telegram/token",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"connect",botId,credentialId:inspectedBot.credentialId,initData:telegramInitData()})});const result=await response.json() as {connected?:boolean;bot?:{username?:string};error?:string};if(!response.ok||!result.connected)throw new Error(result.error||"Не удалось подключить бота");setConnection({status:"connected",username:result.bot?.username??inspectedBot.bot.username,mode:"botfather"});setInspectedBot(null)}catch(error){setConnectionError(error instanceof Error?error.message:"Не удалось подключить бота")}finally{setConnectionState("idle")}
 }
 async function disconnectTelegram(){
  if(!botId)return;setConnectionError("");setConnectionState("disconnecting");
  try{const response=await fetch("/api/channels/telegram/token",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"disconnect",botId,initData:telegramInitData()})});const result=await response.json() as {disconnected?:boolean;error?:string};if(!response.ok||!result.disconnected)throw new Error(result.error||"Не удалось отключить бота");setConnection(null);setPublishState("idle")}catch(error){setConnectionError(error instanceof Error?error.message:"Не удалось отключить бота")}finally{setConnectionState("idle")}
 }
 if(loadState==="loading")return <main className="grid min-h-screen place-items-center bg-[#f4f6f8] text-sm text-[#667085]"><span className="flex items-center gap-3"><LoaderCircle className="size-5 animate-spin"/>Загружаем данные бота…</span></main>;
 if(loadState==="error")return <main className="grid min-h-screen place-items-center bg-[#f4f6f8] p-5 text-[#101828]"><section className="w-full max-w-lg rounded-[24px] border border-[#e4e7ec] bg-white p-8 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff1f3] text-[#c01048]"><Bot/></span><h1 className="mt-5 text-2xl font-semibold">Не удалось открыть редактор</h1><p className="mt-2 text-sm leading-6 text-[#667085]">{loadError}</p><div className="mt-6 flex justify-center gap-3"><Link href="/workspace" className="inline-flex h-11 items-center rounded-xl border border-[#d0d5dd] px-4 text-sm font-semibold no-underline">В кабинет</Link><button onClick={()=>location.reload()} className="h-11 rounded-xl bg-[#101828] px-5 text-sm font-semibold text-white">Повторить</button></div></section></main>;
 return <main className="min-h-dvh bg-[#f9fafb] text-[#080b2b] xl:h-dvh xl:overflow-hidden">
  <div className="mx-auto grid min-h-dvh max-w-[1600px] xl:h-full xl:min-h-0 xl:grid-cols-[270px_minmax(0,1fr)]">
   <aside className="flex min-h-0 flex-col border-r border-[#cbd5e0] bg-[#f1f2f4] px-4 py-5 xl:h-full xl:overflow-y-auto">
    <Link href="/workspace" className="flex items-center gap-2 rounded-lg px-1 no-underline"><span className="grid size-9 place-items-center rounded-[9px] bg-[#4420e7] text-white"><Bot className="size-5"/></span><strong className="text-[18px] tracking-[-.02em] text-[#080b2b]">BotStudio</strong></Link>
    <div className="mt-5 flex h-10 items-center gap-2 rounded-lg border border-[#cbd5e0] bg-[#f8f9fb] px-3 text-[#718096]"><Eye className="size-4"/><span className="text-xs">Поиск смысла</span><span className="ml-auto rounded border px-1 text-[10px]">⌘1</span></div>
    <nav className="mt-7 space-y-1 text-sm">
     <Link href="/workspace" className="flex h-[42px] items-center gap-3 rounded-lg px-3 text-[#080b2b] no-underline"><Bot size={19}/>Главная</Link>
     <Link href="/workspace" className="flex h-[42px] items-center gap-3 rounded-lg px-3 text-[#080b2b] no-underline"><Save size={19}/>Заказы</Link>
     <Link href="/workspace" className="flex h-[42px] items-center gap-3 rounded-lg px-3 text-[#080b2b] no-underline"><Smartphone size={19}/>Продукты</Link>
     <Link href="/workspace" className="flex h-[42px] items-center gap-3 rounded-lg px-3 text-[#080b2b] no-underline"><Eye size={19}/>Аналитика</Link>
     <Link href="/workspace" className="flex h-[42px] items-center gap-3 rounded-lg px-3 text-[#080b2b] no-underline"><MessageCircle size={19}/>Клиенты</Link>
    </nav>
    <p className="mt-7 px-3 text-[11px] font-semibold uppercase tracking-[.06em]">Интеграция</p>
    <div className="mt-3 rounded-[9px] bg-[#4420e7] px-3 py-3 text-[14px] font-medium text-white"><span className="flex items-center gap-2"><Send size={17}/>Телеграм бот <ChevronRight className="ml-auto size-4 rotate-90"/></span></div>
    <nav className="ml-4 border-l border-[#c5bafa] pl-2 text-sm">
     <button type="button" onClick={()=>{setActiveSection("message");setPreviewMode("telegram")}} className={`mt-1 flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left ${activeSection==="message"?"bg-[#e8e2ff] text-[#4420e7]":"text-[#080b2b]"}`}>Все боты<ChevronRight size={14}/></button>
     <button type="button" onClick={()=>setActiveSection("buttons")} className={`mt-1 flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left ${activeSection==="buttons"?"bg-[#e8e2ff] text-[#4420e7]":"text-[#080b2b]"}`}>Все WorkFlow<ChevronRight size={14}/></button>
     <button type="button" onClick={()=>setActiveSection("miniapp")} className={`mt-1 flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left ${activeSection==="miniapp"?"bg-[#e8e2ff] text-[#4420e7]":"text-[#080b2b]"}`}>Мини-приложение<ChevronRight size={14}/></button>
     <button type="button" onClick={()=>setActiveSection("publish")} className={`mt-1 flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left ${activeSection==="publish"?"bg-[#e8e2ff] text-[#4420e7]":"text-[#080b2b]"}`}>Подключение<ChevronRight size={14}/></button>
    </nav>
    <div className="mt-auto space-y-3 border-t border-[#dfe4ea] pt-5 text-sm text-[#718096]"><Link href="/workspace" className="block no-underline">⚙ Настройки</Link><span className="block">☾ Тёмная сторона</span><span className="block border-t border-[#dfe4ea] pt-3 text-xs">Bot Studio · Редактор</span></div>
   </aside>
   <div className="flex min-h-0 min-w-0 flex-col px-5 py-5 sm:px-8 xl:h-full xl:overflow-hidden xl:px-12">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <Link href="/workspace" className="flex items-center gap-3 text-sm font-semibold text-[#080b2b] no-underline"><ArrowLeft className="size-5 text-[#4420e7]"/>Изменить данные</Link>
     <div className="flex gap-2"><button onClick={save} disabled={!dirty} className="h-10 rounded-[8px] border border-[#cbd5e0] px-4 text-sm font-medium disabled:opacity-50">Сохранить</button><button onClick={publish} className="h-10 rounded-[8px] bg-[#4420e7] px-4 text-sm font-semibold !text-white">Опубликовать</button></div>
    </div>
    <div className={`mt-7 min-h-0 flex-1 ${activeSection==="message"?"grid max-w-[850px] items-start gap-6 lg:grid-cols-[minmax(0,460px)_minmax(0,370px)]":"grid max-w-[1150px] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,370px)]"} xl:ml-[clamp(0px,7vw,120px)] xl:overflow-hidden`}>
    <section className="min-h-0 min-w-0 space-y-5 xl:h-full xl:overflow-y-auto xl:pr-1">
    {activeSection==="message" && <div className="rounded-[10px] border border-[#dadadd] bg-white px-4 py-5">
      <div className="space-y-4 text-[14px]">
       <div className="flex items-center gap-4">
        <div className="grid size-[82px] shrink-0 place-items-center overflow-hidden rounded-full bg-[#e8e2ff] text-[#4420e7]">{avatar?<img src={avatar} alt="Аватар бота" className="size-full object-cover"/>:<Bot size={28}/>}</div>
        <label className="min-w-0 flex-1 text-sm font-medium">Аватар Telegram
         <span className="mt-1 block text-xs font-normal text-[#718096]">Рекомендуем квадратное фото. PNG, JPG или WebP до 2 МБ.</span>
         <input type="file" accept="image/png,image/jpeg,image/webp" disabled={avatarBusy} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadAvatar(file);event.currentTarget.value="";}} className="mt-2 block w-full text-xs file:mr-3 file:rounded-[8px] file:border file:border-[#cbd5e0] file:bg-white file:px-3 file:py-2 file:text-[#4420e7]"/>
        </label>
       </div>
       <Field label="Название бота *"><input value={name} maxLength={64} onChange={e=>change(()=>setName(e.target.value))} placeholder="Название бота"/></Field>
       <Field label="Токен бота *"><div className="flex h-10 items-center justify-between rounded-[8px] border border-[#cbd5e0] bg-[#f8f9fb] px-3 text-sm"><span className="truncate text-[#718096]">{connection?.status==="connected"?`@ ${connection.username||"Подключён"} · защищён`:"Подключается в отдельном разделе"}</span><button onClick={()=>setActiveSection("publish")} className="ml-2 shrink-0 text-[#4420e7]"><KeyRound size={17}/></button></div></Field>
       <Field label="Описание бота"><textarea rows={3} maxLength={512} value={description} onChange={e=>change(()=>setDescription(e.target.value))} placeholder="Опишите своего бота"/></Field>
       <Field label="Bio — короткая информация"><input maxLength={120} value={bio} onChange={e=>change(()=>setBio(e.target.value))} placeholder="Кратко о боте · до 120 символов"/></Field>
       <Field label="Приветствие после /start"><textarea rows={3} maxLength={4096} value={welcome} onChange={e=>change(()=>setWelcome(e.target.value))} placeholder="Здравствуйте! Чем можем помочь?"/></Field>
       <p className="text-[12px] text-[#94a3b8]">ⓘ Bio: {bio.length}/120 · Описание: {description.length}/512 · Приветствие: {welcome.length}/4096</p>
       <div className="grid grid-cols-2 gap-3 pt-1"><Link href="/workspace" className="grid h-10 place-items-center rounded-[8px] border border-[#cbd5e0] text-[13px] font-medium text-[#718096] no-underline">Отмена</Link><button type="button" disabled={!dirty} onClick={()=>void save()} className="h-10 rounded-[8px] bg-[#4420e7] text-[13px] font-semibold !text-white disabled:opacity-60">Сохранить</button></div>
      </div>
    </div>}
    {activeSection==="buttons" && <div className="rounded-[22px] border border-[#e4e7ec] bg-white p-5 sm:p-7">
      <span className="text-xs font-semibold text-[#6d45f5]">Шаг 2 · Telegram</span>
      <h1 className="mt-2 text-2xl font-semibold">Кнопки под сообщением</h1>
      <p className="mt-2 text-sm leading-6 text-[#667085]">Эти кнопки появятся под сообщением /start. Выберите для каждой кнопку действие: открыть Mini App, перейти по ссылке или отправить ответ в чат.</p>
      <div className="mt-6 space-y-3">{buttons.map((button,index)=><div key={button.id} className="rounded-2xl border border-[#e4e7ec] p-4">
       <div className="flex items-center gap-3"><GripVertical className="size-4 shrink-0 text-[#98a2b3]"/><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f2f4f7] text-xs font-semibold">{index+1}</span><input aria-label={`Текст кнопки ${index+1}`} maxLength={60} value={button.label} onChange={e=>change(()=>setButtons(v=>v.map(x=>x.id===button.id?{...x,label:e.target.value}:x)))} placeholder="Название кнопки" className="h-10 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"/><button type="button" onClick={()=>change(()=>setButtons(v=>v.filter(x=>x.id!==button.id)))} aria-label="Удалить кнопку" className="grid size-9 shrink-0 place-items-center rounded-lg text-[#98a2b3] hover:bg-[#fff1f3] hover:text-[#c01048]"><Trash2 className="size-4"/></button></div>
       <div className="mt-3 grid gap-3 pl-0 sm:pl-11"><label className="text-xs font-medium text-[#667085]">Действие кнопки<select aria-label={`Действие кнопки ${index+1}`} value={button.action} onChange={e=>change(()=>setButtons(v=>v.map(x=>x.id===button.id?{...x,action:e.target.value as "home"|"url"|"reply"}:x)))} className="mt-1 block h-10 w-full rounded-xl border border-[#d0d5dd] bg-white px-3 text-sm text-[#101828]"><option value="home">Открыть Mini App</option><option value="url">Открыть ссылку</option><option value="reply">Отправить сообщение</option></select></label>{button.action==="url"&&<label className="text-xs font-medium text-[#667085]">HTTPS-адрес<input type="url" value={button.url??""} onChange={e=>change(()=>setButtons(v=>v.map(x=>x.id===button.id?{...x,url:e.target.value}:x)))} placeholder="https://example.com" className="mt-1 block h-10 w-full rounded-xl border border-[#d0d5dd] px-3 text-sm text-[#101828]"/></label>}{button.action==="reply"&&<label className="text-xs font-medium text-[#667085]">Текст ответа бота<textarea maxLength={1000} rows={4} value={button.replyText??""} onChange={e=>change(()=>setButtons(v=>v.map(x=>x.id===button.id?{...x,replyText:e.target.value}:x)))} placeholder="Например: Наш адрес: Ташкент, ..." className="mt-1 block min-h-24 w-full rounded-xl border border-[#d0d5dd] p-3 text-sm text-[#101828]"/></label>}</div>
       {button.action==="reply"&&<div className="mt-4 rounded-xl bg-[#f8f7ff] p-4">
        <div className="flex items-start justify-between gap-3"><div><strong className="text-sm">Следующие кнопки</strong><p className="mt-1 text-xs leading-5 text-[#667085]">Появятся под ответом бота. До 4 кнопок. Так можно построить второй шаг диалога.</p></div>
         <button type="button" aria-label="Добавить следующий шаг" disabled={(button.nextButtons?.length??0)>=4} onClick={()=>change(()=>setButtons(v=>v.map(root=>root.id===button.id?{...root,nextButtons:[...(root.nextButtons??[]),{id:crypto.randomUUID(),label:"Новая кнопка",action:"reply",replyText:"Спасибо за обращение!"}]}:root)))} className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[#5934dc] disabled:opacity-40"><Plus className="size-4"/></button></div>
        <div className="mt-3 space-y-3">{(button.nextButtons??[]).map((next,j)=><div key={next.id} className="rounded-xl border border-[#e4e7ec] bg-white p-3">
         <div className="flex items-center gap-2"><span className="text-xs text-[#98a2b3]">{j+1}</span><input aria-label={`Название следующей кнопки ${j+1}`} maxLength={60} value={next.label} onChange={e=>change(()=>setButtons(v=>v.map(root=>root.id===button.id?{...root,nextButtons:root.nextButtons?.map(x=>x.id===next.id?{...x,label:e.target.value}:x)}:root)))} className="h-9 min-w-0 flex-1 border-b border-[#e4e7ec] text-sm outline-none"/><button type="button" aria-label="Удалить следующий шаг" onClick={()=>change(()=>setButtons(v=>v.map(root=>root.id===button.id?{...root,nextButtons:root.nextButtons?.filter(x=>x.id!==next.id)}:root)))}><Trash2 className="size-4 text-[#98a2b3]"/></button></div>
         <select aria-label={`Действие следующей кнопки ${j+1}`} value={next.action} onChange={e=>change(()=>setButtons(v=>v.map(root=>root.id===button.id?{...root,nextButtons:root.nextButtons?.map(x=>x.id===next.id?{...x,action:e.target.value as "home"|"url"|"reply"}:x)}:root)))} className="mt-3 h-10 w-full rounded-lg border border-[#d0d5dd] bg-white px-2 text-sm"><option value="reply">Ответить сообщением</option><option value="home">Открыть Mini App</option><option value="url">Открыть ссылку</option></select>
         {next.action==="reply"&&<textarea rows={3} maxLength={1000} placeholder="Ответ на этом шаге" value={next.replyText??""} onChange={e=>change(()=>setButtons(v=>v.map(root=>root.id===button.id?{...root,nextButtons:root.nextButtons?.map(x=>x.id===next.id?{...x,replyText:e.target.value}:x)}:root)))} className="mt-3 w-full rounded-lg border border-[#d0d5dd] p-3 text-sm"/>}
         {next.action==="url"&&<input type="url" placeholder="https://example.com" value={next.url??""} onChange={e=>change(()=>setButtons(v=>v.map(root=>root.id===button.id?{...root,nextButtons:root.nextButtons?.map(x=>x.id===next.id?{...x,url:e.target.value}:x)}:root)))} className="mt-3 h-10 w-full rounded-lg border border-[#d0d5dd] px-3 text-sm"/>}
        </div>)}</div>
       </div>}
      </div>)}</div>
      <button type="button" onClick={()=>change(()=>setButtons(v=>[...v,{id:crypto.randomUUID(),label:"Открыть каталог",action:"home"}]))} disabled={buttons.length>=8} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl border border-[#d0d5dd] px-4 text-sm font-semibold disabled:opacity-40"><Plus className="size-4"/>Добавить кнопку</button>
      <p className="mt-4 text-xs text-[#667085]">Кнопки открывают Mini App, переходят на HTTPS-сайт или отправляют сообщение в Telegram. После ответа можно показать кнопки второго шага. Условия и более длинные цепочки добавим позже.</p>
    </div>}
    {activeSection==="miniapp" && <div className="rounded-[22px] border border-[#e4e7ec] bg-white p-5 sm:p-7">
      <span className="text-xs font-semibold text-[#6d45f5]">Шаг 3 · Mini App</span>
      <h1 className="mt-2 text-2xl font-semibold">Мини-приложение для клиентов</h1>
      <p className="mt-2 text-sm leading-6 text-[#667085]">Mini App — это отдельный интерфейс с каталогом, корзиной и заказами. Для создания Telegram-бота добавлять блюдо не обязательно.</p>
      <div className="mt-6 space-y-4"><Field label="Основной цвет Mini App"><div className="flex items-center gap-3"><input type="color" value={color} onChange={e=>change(()=>setColor(e.target.value))} className="size-11 rounded-xl border border-[#d0d5dd] p-1"/><input value={color} onChange={e=>change(()=>setColor(e.target.value))} className="h-11 flex-1 rounded-xl border border-[#d0d5dd] px-3"/></div></Field><div className="rounded-2xl bg-[#f9fafb] p-4 text-sm leading-6 text-[#667085]">Товары, фотографии и категории настраиваются в каталоге кабинета. Отсутствие товаров не мешает сохранить бота.</div><Link href="/workspace" className="inline-flex items-center gap-2 rounded-xl border border-[#d0d5dd] px-4 py-3 text-sm font-semibold">Перейти в кабинет <ExternalLink className="size-4"/></Link></div>
    </div>}
    {activeSection==="publish" && <div className="rounded-[22px] border border-[#e4e7ec] bg-white p-5 sm:p-7">
      <span className="text-xs font-semibold text-[#6d45f5]">Шаг 4 · Запуск</span>
      <h1 className="mt-2 text-2xl font-semibold">Подключить Telegram</h1>
      <p className="mt-2 text-sm leading-6 text-[#667085]">Основной способ для MVP — создать бота через официальный @BotFather и безопасно подключить его токен. Токен шифруется на сервере и никогда не возвращается в интерфейс.</p>
      {connection?.status==="connected" ? <div className="mt-6 rounded-2xl border border-[#b7ebcd] bg-[#f0fdf4] p-5">
        <div className="flex flex-wrap items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-white text-[#079455]"><ShieldCheck className="size-5"/></span><div className="min-w-0 flex-1"><strong className="block text-sm">Telegram подключён</strong><span className="mt-1 block truncate text-xs text-[#4f6f5c]">@{connection.username||"telegram_bot"} · {connection.mode==="botfather"?"BotFather":"Bot Studio Manager"}</span></div><button type="button" onClick={disconnectTelegram} disabled={connectionState!=="idle"} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#b7ebcd] bg-white px-3 text-xs font-semibold text-[#344b3d] disabled:opacity-50"><Unplug className="size-4"/>{connectionState==="disconnecting"?"Отключаем…":"Отключить"}</button></div>
        <button type="button" onClick={publish} disabled={publishState!=="idle"&&publishState!=="published"} className="app-primary-button mt-5 h-12 px-6"><Send className="size-4"/>Опубликовать бота</button>
      </div> : <div className="mt-6 space-y-4">
        <section className="rounded-2xl border border-[#e4e7ec] p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f0ecff] text-[#6541f5]"><KeyRound className="size-5"/></span><div><strong className="text-sm">Подключить токен BotFather</strong><p className="mt-1 text-xs leading-5 text-[#667085]">Откройте @BotFather → /newbot или /mybots → API Token. Вставьте токен ниже и подтвердите найденного бота.</p></div></div>
          {!inspectedBot ? <div className="mt-4 flex flex-col gap-2 sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">Telegram Bot API token</span><input type="password" autoComplete="off" value={telegramToken} onChange={event=>setTelegramToken(event.target.value)} placeholder="123456789:AA…" className="h-12 w-full rounded-xl border border-[#d0d5dd] px-4 text-sm outline-none focus:border-[#7654f6] focus:ring-2 focus:ring-[#7654f6]/15"/></label><button type="button" onClick={inspectTelegramToken} disabled={!telegramToken.trim()||connectionState!=="idle"} className="app-primary-button h-12 px-5">{connectionState==="checking"?<LoaderCircle className="size-4 animate-spin"/>:<ShieldCheck className="size-4"/>}{connectionState==="checking"?"Проверяем…":"Проверить"}</button></div> : <div className="mt-4 rounded-xl bg-[#f8f7ff] p-4"><span className="text-xs text-[#667085]">Найден Telegram-бот</span><strong className="mt-1 block text-sm">{inspectedBot.bot.name} · @{inspectedBot.bot.username}</strong><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={confirmTelegramConnection} disabled={connectionState!=="idle"} className="app-primary-button h-11 px-5">{connectionState==="connecting"?<LoaderCircle className="size-4 animate-spin"/>:<Check className="size-4"/>}{connectionState==="connecting"?"Подключаем…":"Подтвердить подключение"}</button><button type="button" onClick={()=>setInspectedBot(null)} disabled={connectionState!=="idle"} className="h-11 rounded-xl border border-[#d0d5dd] bg-white px-4 text-sm font-semibold">Другой токен</button></div></div>}
        </section>
        <section className="rounded-2xl bg-[#f9fafb] p-5"><strong className="text-sm">Автоматическое создание через Manager</strong><p className="mt-1 text-xs leading-5 text-[#667085]">Альтернативный способ. Telegram попросит подтвердить аккаунт, после чего Bot Studio Manager создаст и привяжет бота.</p><button type="button" onClick={publish} disabled={publishState!=="idle"&&publishState!=="published"} className="mt-4 h-11 rounded-xl border border-[#d0d5dd] bg-white px-4 text-sm font-semibold disabled:opacity-40">Продолжить через Manager</button></section>
      </div>}
      {connectionError&&<p role="alert" className="mt-4 rounded-xl bg-[#fff1f3] px-4 py-3 text-sm text-[#b42318]">{connectionError}</p>}
      <p className="mt-4 text-xs text-[#98a2b3]">Предпросмотр справа не отправляет сообщения в Telegram, пока бот не подключён и не опубликован.</p>
    </div>}
    </section>
    <aside className="min-h-0 min-w-0 xl:h-full xl:overflow-hidden">
     <div className="mb-3 flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-[#080b2b]">Предпросмотр</span>
      <div className="flex gap-1 rounded-lg bg-[#eef0f4] p-1">
       <button type="button" onClick={()=>{setPreviewMode("telegram");setFigmaPreview("profile")}} className={`rounded-md px-2 py-1 text-[11px] ${previewMode==="telegram"&&figmaPreview==="profile"?"bg-white text-[#4420e7] shadow-sm":"text-[#718096]"}`}>Профиль</button>
       <button type="button" onClick={()=>{setPreviewMode("telegram");setFigmaPreview("chat")}} className={`rounded-md px-2 py-1 text-[11px] ${previewMode==="telegram"&&figmaPreview==="chat"?"bg-white text-[#4420e7] shadow-sm":"text-[#718096]"}`}>Чат</button>
       <button type="button" onClick={()=>setPreviewMode("miniapp")} className={`rounded-md px-2 py-1 text-[11px] ${previewMode==="miniapp"?"bg-white text-[#4420e7] shadow-sm":"text-[#718096]"}`}>Mini App</button>
      </div>
     </div>
     {previewMode==="telegram"?<FigmaTelegramPreview name={name} description={figmaPreview==="chat"?welcome:description} buttons={buttons} color={color} view={figmaPreview} avatar={avatar} bio={bio}/>:
     <div className="overflow-hidden rounded-xl border border-[#cbd5e0] bg-white p-5"><div className="rounded-lg p-6 text-white" style={{background:color}}><h3 className="text-lg font-semibold">{name}</h3><p className="mt-3 text-sm">{description}</p></div><p className="mt-5 text-xs text-[#718096]">Предпросмотр Mini App · полный клиентский интерфейс открывается через Telegram</p></div>}
    </aside>
    </div>
   </div>
  </div>
  {publishState!=="idle"&&publishState!=="published"&&publishState!=="connection"&&publishState!=="error"&&<PublishOverlay state={publishState}/>} 
  {publishState==="published"&&<div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#101828] px-5 py-4 text-sm font-semibold text-white shadow-xl"><Check className="size-5 text-[#6ce9a6]"/>Бот опубликован. Изменения доступны в Telegram.</div>}
  {publishState==="error"&&<div className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#7a271a] px-5 py-4 text-sm font-semibold text-white shadow-xl"><span className="flex-1">{loadError||"Не удалось выполнить операцию. Повторите попытку."}</span><button onClick={()=>setPublishState("idle")}><Trash2 className="size-4"/></button></div>}
  {publishState==="connection"&&connectUrl&&<div className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#101828] px-5 py-4 text-sm text-white shadow-xl"><span className="flex-1"><strong className="block">Проект сохранён</strong><small className="text-white/70">Подтвердите создание бота в Telegram — после этого публикация завершится автоматически.</small></span><a href={connectUrl} className="shrink-0 rounded-xl bg-white px-4 py-2 font-semibold text-[#101828]">Открыть Telegram</a></div>}
 </main>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label><span className="mb-2 block text-sm font-medium">{label}</span><span className="[&>input]:h-10 [&>input]:w-full [&>input]:rounded-[8px] [&>input]:border [&>input]:border-[#cbd5e0] [&>input]:px-3 [&>textarea]:min-h-[70px] [&>textarea]:w-full [&>textarea]:rounded-[8px] [&>textarea]:border [&>textarea]:border-[#cbd5e0] [&>textarea]:p-3">{children}</span></label>}
function PublishOverlay({state}:{state:PublishState}){const title=state==="saving"?"Сохраняем изменения":state==="validating"?"Проверяем данные":"Публикуем в Telegram";const text=state==="publishing"?"Собираем новую версию Mini App и обновляем меню бота. Обычно это занимает до минуты.":"Проверяем обязательные поля, изображения и настройки кнопок.";return <div className="fixed inset-0 z-50 grid place-items-center bg-[#101828]/45 p-4"><div className="w-full max-w-md rounded-[24px] bg-white p-7 text-center shadow-2xl"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f0ecff] text-[#6d45f5]"><LoaderCircle className="size-7 animate-spin"/></span><h2 className="mt-5 text-xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#667085]">{text}</p><div className="mt-6 h-2 overflow-hidden rounded-full bg-[#eaecf0]"><div className={`h-full rounded-full bg-[#6d45f5] transition-all ${state==="publishing"?"w-[82%]":"w-[45%]"}`}/></div><p className="mt-3 text-xs text-[#98a2b3]">Не закрывайте окно до завершения публикации</p></div></div>}
